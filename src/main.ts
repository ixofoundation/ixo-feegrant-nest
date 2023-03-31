import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { authorization } from './auth.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.use(authorization);
  await app.listen(3000);
}
bootstrap();
