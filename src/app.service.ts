import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSigningClient, utils } from '@ixo/impactxclient-sdk';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { Any } from 'cosmjs-types/google/protobuf/any';
import { BasicAllowance } from 'cosmjs-types/cosmos/feegrant/v1beta1/feegrant';
import { MsgGrantAllowance } from 'cosmjs-types/cosmos/feegrant/v1beta1/tx';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  private mnemonic = this.configService.get<string>('MNEMONIC');
  private rpcUrl = this.configService.get<string>('RPC_URL');

  get(): string {
    return 'API Running';
  }

  async feeGrant(grantee: string) {
    try {
      const now = new Date();

      const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, {
        prefix: 'ixo',
      });
      const client = await createSigningClient(this.rpcUrl, wallet);
      const accounts = await wallet.getAccounts();
      const account = accounts[0];
      const address = account.address;

      const allowance: Any = {
        typeUrl: '/cosmos.feegrant.v1beta1.BasicAllowance',
        value: Uint8Array.from(
          BasicAllowance.encode({
            spendLimit: [
              {
                denom: 'uxio',
                amount: '10000000',
              },
            ],
            expiration: utils.proto.toTimestamp(
              new Date(now.setDate(now.getDate() + 31)),
            ),
          }).finish(),
        ),
      };

      const value: MsgGrantAllowance = {
        granter: address,
        grantee: grantee,
        allowance: allowance,
      };

      const message = {
        typeUrl: '/cosmos.feegrant.v1beta1.MsgGrantAllowance',
        value: value,
      };

      return client.signAndBroadcast(address, [message], {
        amount: [
          {
            denom: 'uixo',
            amount: '100000',
          },
        ],
        gas: '4000000',
      });
    } catch (error) {
      return error.toString();
    }
  }
}
