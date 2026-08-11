import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { AUDIT_KEY, AuditMeta } from './audit.decorator';
import { AuthUser } from '../auth/auth-user.interface';

/**
 * 操作审计拦截器（全局，由 AuditModule 以 APP_INTERCEPTOR 注册）。
 * - 仅当接口打了 @Audit 才落库；未标记的接口直接放行。
 * - 在响应成功后异步写 OperationLog，fire-and-forget，不阻塞主流程，失败仅记日志。
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const meta = this.reflector.getAllAndOverride<AuditMeta>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    const ip =
      req.ip ||
      req.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim() ||
      null;

    // 资源标识：优先路由参数 id，其次版本参数 vid，再次 body.id
    const resourceId: string | null =
      req.params?.id ?? req.params?.vid ?? req.body?.id ?? null;
    const detail = this.summarize(req.body);

    return next.handle().pipe(
      tap({
        next: () => {
          this.prisma.operationLog
            .create({
              data: {
                userId: user?.sub ?? null,
                username: user?.phone ?? null,
                staffRoleKey: user?.staffRoleKey ?? null,
                action: meta.action,
                module: meta.module,
                resourceId: resourceId ? String(resourceId) : null,
                detail,
                ip,
              },
            })
            .catch((e) => console.error('[AuditInterceptor] 写操作日志失败', e));
        },
      }),
    );
  }

  /** 脱敏：剔除密码/令牌类字段，保留结构化摘要 */
  private summarize(body: any): any {
    if (!body || typeof body !== 'object') return null;
    const { password, passwordHash, token, accessToken, refreshToken, ...rest } =
      body;
    return rest;
  }
}
