import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { cosmos, createSigningClient, utils } from '@ixo/impactxclient-sdk';
var store = require('store');

require('dotenv').config();

export type SigningClientType = Awaited<ReturnType<typeof createSigningClient>>;

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

  async feegrant(grantee: string, durationInDays = 31) {
    // check if client not initiated yet redo it and await
    if (!this.signingClient || !this.wallet) await this.init();

    const now = new Date();
    const accounts = await this.wallet.getAccounts();
    const address = accounts[0].address;

    const message = {
      typeUrl: '/cosmos.feegrant.v1beta1.MsgGrantAllowance',
      value: cosmos.feegrant.v1beta1.MsgGrantAllowance.fromPartial({
        granter: address,
        grantee: grantee,
        allowance: {
          typeUrl: '/cosmos.feegrant.v1beta1.BasicAllowance',
          value: cosmos.feegrant.v1beta1.BasicAllowance.encode(
            cosmos.feegrant.v1beta1.BasicAllowance.fromPartial({
              // spendLimit: [
              //   {
              //     denom: 'uxio',
              //     amount: '10000000',
              //   },
              // ],
              expiration: utils.proto.toTimestamp(
                new Date(now.setDate(now.getDate() + durationInDays)),
              ),
            }),
          ).finish(),
        },
      }),
    };

    return this.signingClient.signAndBroadcast(
      address,
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
}
