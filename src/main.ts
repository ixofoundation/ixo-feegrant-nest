import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { authorization } from './auth.middleware';
import * as Sentry from '@sentry/node';
import '@sentry/tracing';

require('dotenv').config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    maxValueLength: 5000,
    tracesSampleRate: 1.0,
  });
  await app.listen(process.env.PORT || 3000);
}
bootstrap();

// patch for bigint to json
// @ts-ignore
BigInt.prototype.toJSON = function () {
  return this.toString();
};
