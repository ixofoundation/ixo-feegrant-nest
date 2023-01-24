import { Controller, Get, Param, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get(['', '/status'])
  get(): string {
    return this.appService.get();
  }

  @Post('/createfeegrant/:grantee')
  createFeeGrant(@Param('grantee') grantee: string) {
    return this.appService.createFeeGrant(grantee);
  }
}
