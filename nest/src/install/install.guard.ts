import { Injectable, CanActivate, ExecutionContext, HttpStatus, HttpException } from '@nestjs/common';
import { InstallService } from './install.service';

// 系统安装守卫：未安装时只放行 install/health/metrics 路由，其余返回 503
@Injectable()
export class InstallGuard implements CanActivate {
  constructor(private readonly installService: InstallService) {}

  // 白名单前缀（按 controller 路径前缀匹配，不含 /api/v1 前缀）
  private readonly ALLOWED_WHEN_NOT_INSTALLED = ['install', 'health', 'metrics'];

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const path = req.route?.path || req.url || '';

    // 取 controller 前缀（/api/v1/xxx/... → xxx）
    const match = path.match(/^\/api\/v\d+\/([^/]+)/);
    const prefix = match?.[1] ?? '';

    const installed = await this.installService.isInstalled();

    if (installed) return true;

    // 未安装：只放行白名单路由
    if (this.ALLOWED_WHEN_NOT_INSTALLED.includes(prefix)) return true;

    throw new HttpException(
      { statusCode: HttpStatus.SERVICE_UNAVAILABLE, message: '系统尚未初始化，请先完成安装向导' },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
