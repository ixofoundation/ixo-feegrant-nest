import { Injectable } from '@nestjs/common';
import { IxoFeegrant } from './granter';
import { assertIsDeliverTxSuccess } from '@cosmjs/stargate';

@Injectable()
export class AppService {
  constructor() {}

  get(): string {
    return 'Welcome to Ixo fee grant service!';
  }

  async feeGrant(grantee: string) {
    try {
      const res = await IxoFeegrant.instance.feegrant(grantee);
      assertIsDeliverTxSuccess(res);
      return res;
    } catch (error) {
      return error.toString();
    }
  }
}
