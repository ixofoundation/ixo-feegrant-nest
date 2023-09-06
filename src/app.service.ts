import { Injectable } from '@nestjs/common';
import { IxoFeegrant } from './granter';
import { assertIsDeliverTxSuccess } from '@cosmjs/stargate';
import * as Sentry from '@sentry/node';

@Injectable()
export class AppService {
  constructor() {}

  get(): string {
    return 'Welcome to Ixo fee grant service!';
  }

  async feeGrantExtend(grantee: string) {
    try {
      const res = await IxoFeegrant.instance.feegrant(grantee, 7);
      assertIsDeliverTxSuccess(res);
      return res;
    } catch (error) {
      return error.toString();
    }
  }

  async feeGrant(grantee: string) {
    try {
      const res = await IxoFeegrant.instance.feegrant(grantee);
      assertIsDeliverTxSuccess(res);
      if (res.code != 0) Sentry.captureException(res);
      return res;
    } catch (error) {
      return error.toString();
    }
  }
}
