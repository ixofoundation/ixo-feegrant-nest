import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSigningClient } from '@ixo/impactxclient-sdk';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import * as Long from 'long';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  private mnemonic = this.configService.get<string>('FEEGRANT_MNEMONIC');
  private spendLimit = this.configService.get<string>('SPEND_LIMIT');
  private rpcUrl = this.configService.get<string>('RPC_URL');

  get(): string {
    return 'API Running';
  }

  async createFeeGrant(grantee: string) {
    try {
      const signer = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, {
        prefix: 'ixo',
      });

      const client = await createSigningClient(this.rpcUrl, signer);

      const address = await signer.getAccounts();
      const timestamp = {
        seconds: new Long(1),
        nanos: 1,
      };
      const spendLimit = { denom: 'uixo', amount: this.spendLimit };

      const allowance = {
        typeUrl: '/cosmos.feegrant.v1beta1.BasicAllowance',
        value: {
          spendLimit: [spendLimit],
          expiration: timestamp,
        },
      };

      const message = {
        typeUrl: '/cosmos.feegrant.v1beta1.MsgGrantAllowance',
        value: {
          allowance: allowance,
          grantee: grantee,
          granter: address[0].address,
        },
      };

      const fee = {
        amount: [
          {
            denom: 'uixo',
            amount: '100000',
          },
        ],
        gas: '4000000',
      };

      const response = client.signAndBroadcast(
        address[0].address,
        [message],
        fee,
      );

      return response;
    } catch (error) {
      console.log(error);
      return { error: error.toString() };
    }
  }
}
