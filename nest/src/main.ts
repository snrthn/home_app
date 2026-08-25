import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PinoLoggerService, pinoLogger } from './common/logger/pino-logger.service';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new PinoLoggerService(),
  });
  // 信任代理（Nginx/X-Forwarded-For），限流、日志等需真实客户端 IP
  app.set('trust proxy', 1);
  // helmet 安全头：CSP/HSTS/XSS 等 10+ 项防护
  // /api/docs 路径放宽 CSP（script-src: 'unsafe-inline'），否则 Swagger UI 无法加载
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/docs')) {
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
            styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
            imgSrc: ["'self'", 'data:'],
          },
        },
      })(req, res, next);
    } else {
      helmet()(req, res, next);
    }
  });
  app.use(requestIdMiddleware);
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const config = new DocumentBuilder()
    .setTitle('老马家电维修 API')
    .setDescription('家电维修服务平台后端接口文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
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
  app.useGlobalFilters(new AllExceptionsFilter(pinoLogger));
  const port = process.env.PORT || 3721;
  await app.listen(port);
  pinoLogger.info(`[老马家电] backend listening on http://localhost:${port}`);
}
bootstrap();
