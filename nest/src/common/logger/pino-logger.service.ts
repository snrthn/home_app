import { LoggerService } from '@nestjs/common';
import pino, { Logger } from 'pino';

/**
 * Pino 结构化日志实例：
 * - 生产：纯 JSON 输出到 stdout/stderr，由 PM2 捕获落盘 + 轮转。
 * - 开发：pino-pretty 彩色格式化，直接读终端。
 */
export const pinoLogger: Logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true } },
});

/**
 * NestJS LoggerService 适配层：
 * 将 NestJS 的 log/error/warn/debug/verbose 映射到 Pino 的 info/error/warn/debug/trace，
 * 统一走结构化 JSON 输出，替代 NestJS 默认的 console-based Logger。
 */
export class PinoLoggerService implements LoggerService {
  log(message: string, context?: string) {
    pinoLogger.info(this.ctx(context), message);
  }

  error(message: string, trace?: string, context?: string) {
    pinoLogger.error({ ...this.ctx(context), trace }, message);
  }

  warn(message: string, context?: string) {
    pinoLogger.warn(this.ctx(context), message);
  }

  debug(message: string, context?: string) {
    pinoLogger.debug(this.ctx(context), message);
  }

  verbose(message: string, context?: string) {
    pinoLogger.trace(this.ctx(context), message);
  }

  fatal(message: string, context?: string) {
    pinoLogger.fatal(this.ctx(context), message);
  }

  private ctx(context?: string): Record<string, unknown> {
    return context ? { context } : {};
  }
}
