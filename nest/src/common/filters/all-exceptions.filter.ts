import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { Request, Response } from 'express';
import type { Logger } from 'pino';
import * as Sentry from '@sentry/node';

/**
 * 全局异常过滤器：
 * - HttpException（含 ValidationPipe 校验失败）：透出 status + message（数组 join）；
 * - Prisma 已知错误（如 P2002 唯一约束）：映射为业务可读的 code；
 * - 其余未知异常：统一 500 + code='INTERNAL_ERROR'，不泄露堆栈。
 *
 * 所有异常均经 Pino 结构化记录（含 reqId / method / path / stack），便于日志链路追踪。
 * 前端 getApiErrorMsg 只读 data.message，故 message 字段始终保留在响应顶层。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const reqId = (req as unknown as { requestId?: string }).requestId || 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = '服务器内部错误';
    let logLevel: 'warn' | 'error' = 'error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const msg = (body as { message?: unknown }).message;
        message = Array.isArray(msg)
          ? (msg as unknown[]).join('；')
          : ((msg as string) ?? message);
      }
      // 限流异常：友好 code + 中文提示
      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        code = 'RATE_LIMITED';
        message = '请求过于频繁，请稍后再试';
        logLevel = 'warn';
      } else {
        code = `HTTP_${status}`;
        logLevel = status >= 500 ? 'error' : 'warn';
      }
    } else if (exception instanceof PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;
      code = `DB_${exception.code}`;
      message =
        exception.code === 'P2002'
          ? '数据已存在（唯一约束冲突）'
          : '数据库约束错误';
      logLevel = 'warn';
    } else if (exception instanceof PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'DB_VALIDATION';
      message = '数据校验错误';
      logLevel = 'warn';
    }

    this.logger[logLevel]({
      reqId,
      method: req.method,
      path: req.url,
      code,
      status,
      error: exception instanceof Error ? exception.message : String(exception),
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    if (status >= 500) {
      Sentry.captureException(exception);
    }

    res.status(status).json({
      code,
      message,
      data: null,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
