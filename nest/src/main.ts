import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // CORS：未配置 CORS_ORIGIN 时回落 true（开发态跨端口方便）；
  // 生产务必配置白名单（逗号分隔，如 https://admin.x.com,https://client.x.com），
  // 否则任意来源可带用户凭证请求（跨站凭证泄露风险）。
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
    : true;
  app.enableCors({ origin: corsOrigin, credentials: true });
  app.useStaticAssets(join(process.cwd(), process.env.UPLOAD_DIR || 'uploads'), {
    prefix: '/uploads',
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  const port = process.env.PORT || 3824;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[老马家电] backend listening on http://localhost:${port}`);
}
bootstrap();
