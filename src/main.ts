import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { authorization } from './auth.middleware';

require('dotenv').config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.use(authorization);
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
