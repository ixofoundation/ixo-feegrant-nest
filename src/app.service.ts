import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DirectSecp256k1HdWallet, Registry } from '@cosmjs/proto-signing';
import {
  defaultRegistryTypes as defaultStargateTypes,
  SigningStargateClient,
} from '@cosmjs/stargate';
import { BasicAllowance } from 'cosmjs-types/cosmos/feegrant/v1beta1/feegrant';
import { MsgGrantAllowance } from 'cosmjs-types/cosmos/feegrant/v1beta1/tx';
import { Any } from 'cosmjs-types/google/protobuf/any';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  private mnemonic = this.configService.get<string>('FEEGRANT_MNEMONIC');

  get(): string {
    return 'API Running';
  }

  async createFeeGrant(grantee: string) {
    const myRegistry = new Registry(defaultStargateTypes);
    const signer = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, {
      prefix: 'ixo',
    });
    const client = await SigningStargateClient.connectWithSigner(
      'https://testnet.ixo.earth/rpc/',
      signer,
      { registry: myRegistry },
    );
    const address = await signer.getAccounts();

    const allowance: Any = {
      typeUrl: '/cosmos.feegrant.v1beta1.BasicAllowance',
      value: Uint8Array.from(
        BasicAllowance.encode({
          spendLimit: [
            {
              denom: 'uixo',
              amount: '100000',
            },
          ],
        }).finish(),
      ),
    };
    const grantMsg = {
      typeUrl: '/cosmos.feegrant.v1beta1.MsgGrantAllowance',
      value: MsgGrantAllowance.fromPartial({
        granter: address[0].address,
        grantee: grantee,
        allowance: allowance,
      }),
    };
    const response = await client.signAndBroadcast(
      address[0].address,
      [grantMsg],
      'auto',
      'Create allowance ixo',
    );

    return response;
  }
}
