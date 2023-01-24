import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fromBech32 } from '@cosmjs/encoding';
import { exec } from 'child_process';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  private FEEGRANT_ACCOUNT = this.configService.get<string>('FEEGRANT_ACCOUNT');
  private feegrant_account = this.FEEGRANT_ACCOUNT.toLowerCase();
  private FEEGRANT_AMOUNT = this.configService.get<string>('FEEGRANT_AMOUNT');

  private isValidAddress(input: string): boolean {
    try {
      const { prefix, data } = fromBech32(input);
      if (!prefix.includes('ixo')) {
        return false;
      }
      return data.length === 20;
    } catch {
      return false;
    }
  }

  get(): string {
    return 'API Running';
  }

  createFeeGrant(grantee: string) {
    try {
      if (!this.isValidAddress(grantee)) {
        return 'Invalid Grantee Address';
      }
      exec(
        `simd tx feegrant grant $${this.FEEGRANT_ACCOUNT} $${grantee} --from ${this.feegrant_account} --spend-limit ${this.FEEGRANT_AMOUNT}uixo`,
        (error, stdout, stderr) => {
          if (error) {
            console.log({ error: error.toString() });
            return { error: error.toString() };
          }
          if (stderr) {
            console.log({ stderr: stderr });
            return { stderr: stderr };
          }
          console.log({ stdout: stdout });
          return { stdout: stdout };
        },
      );
    } catch (error) {
      console.log({ error: error.toString() });
      return { error: error.toString() };
    }
  }
}
