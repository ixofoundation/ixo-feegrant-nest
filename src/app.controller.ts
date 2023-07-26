import { Controller, Get, Param, Post, UseInterceptors } from '@nestjs/common';
import { AppService } from './app.service';
import { SentryInterceptor } from './sentry.interceptor';

@UseInterceptors(SentryInterceptor)
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  get(): string {
    return this.appService.get();
  }

  @Post('/feegrant/:address')
  async feeGrant(@Param('address') address: string) {
    try {
      return this.appService.feeGrant(address);
    } catch (error) {
      return error.message;
    }
  }
}
