import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { cosmos, createSigningClient, utils } from '@ixo/impactxclient-sdk';
var store = require('store');

require('dotenv').config();

export type SigningClientType = Awaited<ReturnType<typeof createSigningClient>>;

const DEFAULT_DURATION_DAYS = 365;

export class IxoFeegrant {
  signingClient: SigningClientType;
  wallet: DirectSecp256k1HdWallet;

  constructor() {
    if (!this.signingClient || !this.wallet) this.init();
  }

  public static instance = new IxoFeegrant();

  async init() {
    this.wallet = await DirectSecp256k1HdWallet.fromMnemonic(
      process.env.MNEMONIC,
      { prefix: 'ixo' },
    );
    this.signingClient = await createSigningClient(
      process.env.RPC_URL,
      this.wallet,
      false,
      null,
      {
        getLocalData: (k) => store.get(k),
        setLocalData: (k, d) => store.set(k, d),
      },
    );
  }

  async getGranterAddress(): Promise<string> {
    if (!this.signingClient || !this.wallet) await this.init();
    const accounts = await this.wallet.getAccounts();
    return accounts[0].address;
  }

  private buildGrantMessage(
    granterAddress: string,
    grantee: string,
    expiration: ReturnType<typeof utils.proto.toTimestamp>,
  ) {
    return {
      typeUrl: '/cosmos.feegrant.v1beta1.MsgGrantAllowance',
      value: cosmos.feegrant.v1beta1.MsgGrantAllowance.fromPartial({
        granter: granterAddress,
        grantee,
        allowance: {
          typeUrl: '/cosmos.feegrant.v1beta1.BasicAllowance',
          value: cosmos.feegrant.v1beta1.BasicAllowance.encode(
            cosmos.feegrant.v1beta1.BasicAllowance.fromPartial({
              expiration,
            }),
          ).finish(),
        },
      }),
    };
  }

  async feegrant(grantee: string, durationInDays = DEFAULT_DURATION_DAYS) {
    if (!this.signingClient || !this.wallet) await this.init();

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + durationInDays);

    const granterAddress = await this.getGranterAddress();

    const message = this.buildGrantMessage(
      granterAddress,
      grantee,
      utils.proto.toTimestamp(expiry),
    );

    return this.signingClient.signAndBroadcast(
      granterAddress,
      [message],
      {
        amount: [
          {
            denom: 'uixo',
            amount: '10000',
          },
        ],
        gas: '400000',
      },
      'Feegrant from Ixo',
    );
  }

  // Issue MsgGrantAllowance for many grantees in a single tx. Used by the
  // refresh cron. Fee/gas are scaled to the batch size, with a sim-based
  // adjustment when available so we don't overpay or run out of gas.
  async feegrantBatch(
    grantees: string[],
    durationInDays = DEFAULT_DURATION_DAYS,
  ) {
    if (grantees.length === 0) {
      throw new Error('feegrantBatch called with empty grantees list');
    }
    if (!this.signingClient || !this.wallet) await this.init();

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + durationInDays);
    const expiration = utils.proto.toTimestamp(expiry);

    const granterAddress = await this.getGranterAddress();

    const messages = grantees.map((grantee) =>
      this.buildGrantMessage(granterAddress, grantee, expiration),
    );

    let gas: number;
    try {
      const simGas = await this.signingClient.simulate(
        granterAddress,
        messages,
        undefined,
      );
      gas = Math.ceil(simGas * 1.5);
    } catch {
      // Simulation can fail on RPC hiccups; fall back to a linear estimate
      // matching the existing single-grant fee shape (10000 uixo / 400000 gas).
      gas = messages.length * 400000;
    }

    // 0.025 uixo per gas matches the existing single-grant fee ratio.
    const feeAmount = Math.max(Math.ceil(gas * 0.025), 1000);

    return this.signingClient.signAndBroadcast(
      granterAddress,
      messages,
      {
        amount: [{ denom: 'uixo', amount: feeAmount.toString() }],
        gas: gas.toString(),
      },
      'Feegrant from IXO',
    );
  }
}
