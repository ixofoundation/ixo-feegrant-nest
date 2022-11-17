import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cosmos, createSigningClient } from '@ixo/impactxclient-sdk';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import Long from 'long';

import { Coin } from './types/coin';
import { Timestamp } from './types/timestamp';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  private mnemonic = this.configService.get<string>('FEEGRANT_MNEMONIC');

  get(): string {
    return 'API Running';
  }

  async createFeeGrant(grantee: string) {
    const signer = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, {
      prefix: 'ixo',
    });

    const client = await createSigningClient(
      'https://testnet.ixo.earth/rpc/',
      signer,
    );

    const basicAllowance = cosmos.feegrant.v1beta1.BasicAllowance;
    const address = await signer.getAccounts();
    const timestamp = Timestamp.fromPartial({ seconds: new Long(1), nanos: 1 });
    const spendLimit = Coin.fromPartial({ denom: 'ixo', amount: '1' });

    const allowance = {
      typeUrl: '/cosmos.feegrant.v1beta1.BasicAllowance',
      value: basicAllowance.fromJSON({
        spendLimit: [spendLimit],
        expiration: timestamp,
      }),
    };

    const grant = cosmos.feegrant.v1beta1.Grant;
    const message = {
      typeUrl: '/cosmos.feegrant.v1beta1.Grant',
      value: grant.fromJSON({
        allowance: allowance,
        grantee: grantee,
        granter: address[0].address,
      }),
    };

    const gasUsed = await client.simulate(
      address[0].address,
      [message],
      'feegrant-daemon-ixo',
    );

    const gasPriceStep = {
      low: 0.01,
      average: 0.025,
      high: 0.04,
    };

    const low = gasUsed * gasPriceStep.low;
    const average = gasUsed * gasPriceStep.average;
    const high = gasUsed * gasPriceStep.high;

    const gas = {
      low: low,
      average: average,
      high: high,
    };

    const fee = {
      amount: [
        {
          denom: 'uixo',
          amount: gas.high.toString(),
        },
      ],
      gas: gasUsed.toString(),
    };

    const response = client.signAndBroadcast(
      address[0].address,
      [message],
      fee,
    );

    return response;
  }
}
