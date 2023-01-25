import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { exec } from 'child_process';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.use(helmet());

  try {
    exec(
      `(echo "${process.env.FEEGRANT_MNEMONIC}"; echo "${process.env.FEEGRANT_PASSWORD}") | ixod keys add feegrant --recover`,
      (error, stdout, stderr) => {
        if (error) {
          console.log({ error: error.toString() });
        }
        if (stderr) {
          console.log({ stderr: stderr });
        }
        console.log({ stdout: stdout });
      },
    );
  } catch (error) {
    console.log({ error: error.toString() });
  }

  await app.listen(3000);
}
bootstrap();
