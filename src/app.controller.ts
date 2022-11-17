import { Controller, Get, Param, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get(['', '/status'])
  get(): string {
    return this.appService.get();
  }

  @Post('/createfeegrant/:address')
  async createFeeGrant(@Param('address') address: string) {
    try {
      const res = await this.appService.createFeeGrant(address);
      return res.transactionHash;
    } catch (error) {
      return error;
    }
  }
}
