import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { Request, Response } from 'express';

/**
 * 全局异常过滤器：
 * - HttpException（含 ValidationPipe 校验失败）：透出 status + message（数组 join）；
 * - Prisma 已知错误（如 P2002 唯一约束）：映射为业务可读的 code；
 * - 其余未知异常：统一 500 + code='INTERNAL_ERROR'，不泄露堆栈。
 *
 * 前端 getApiErrorMsg 只读 data.message，故 message 字段始终保留在响应顶层。
 * 只做「兜底格式化」，不为每个业务异常补 code 枚举（属长期债，补了前端才能按 code 分支）。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = '服务器内部错误';

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
      code = `HTTP_${status}`;
    } else if (exception instanceof PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;
      code = `DB_${exception.code}`;
      message =
        exception.code === 'P2002'
          ? '数据已存在（唯一约束冲突）'
          : '数据库约束错误';
    } else if (exception instanceof PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'DB_VALIDATION';
      message = '数据校验错误';
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
