import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * 请求 ID 中间件：为每个请求生成唯一 traceId，贯穿日志链路。
 * 优先复用上游 x-request-id（如网关/CDN 传入），无则生成 UUID v4。
 * 写入 res.header 供前端/下游关联，挂到 req.requestId 供 Pino 日志读取。
 *
 * 不用 module augmentation（@types/express 路径在 NestJS tsconfig 下不生效），
 * 消费方用 (req as unknown as { requestId?: string }) 读取。
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers['x-request-id'] as string) || uuidv4();
  (req as unknown as { requestId: string }).requestId = id;
  res.setHeader('x-request-id', id);
  next();
}
