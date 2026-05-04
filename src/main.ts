import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as Sentry from '@sentry/node';
import '@sentry/tracing';

import { postgresMigrate } from './postgres/migrations';
import {
  DATABASE_URL,
  MIGRATE_DB_PROGRAMATICALLY,
  PORT,
  SENTRY_DSN,
} from './utils/secrets';

require('dotenv').config();

async function bootstrap() {
  // Apply DB migrations on boot when running in environments without shell
  // access (Heroku, GCR, etc.). Off by default in dev.
  if (MIGRATE_DB_PROGRAMATICALLY) {
    console.log('MIGRATE_DB_PROGRAMATICALLY: ', MIGRATE_DB_PROGRAMATICALLY);
    await postgresMigrate(DATABASE_URL);
  }

  const app = await NestFactory.create(AppModule, { cors: true });

  Sentry.init({
    dsn: SENTRY_DSN,
    maxValueLength: 5000,
    tracesSampleRate: 1.0,
  });
  await app.listen(PORT);
}
bootstrap();

// patch for bigint to json
// @ts-ignore
BigInt.prototype.toJSON = function () {
  return this.toString();
};
