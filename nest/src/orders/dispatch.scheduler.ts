import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { OrdersService } from './orders.service';

/**
 * 超时自动派单扫描器（docs/dispatch-design.md §3.5）。
 * 沿用 sla.scheduler 的 setInterval 模式（沙箱无法安装 @nestjs/schedule）：
 * 每 AUTO_DISPATCH_SCAN_MS（默认 60s）扫描一次超时未接订单，
 * 由 autoDispatchOverdue() 取推荐第一名自动指派（预约单豁免，内部幂等）。
 * env：AUTO_DISPATCH_ENABLED=false 时只启动不派单；AUTO_DISPATCH_TIMEOUT_MS 控制超时阈值。
 */
@Injectable()
export class DispatchSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DispatchSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly orders: OrdersService) {}

  onModuleInit() {
    const scanMs = Number(process.env.AUTO_DISPATCH_SCAN_MS ?? 60 * 1000);
    this.timer = setInterval(() => {
      this.orders
        .autoDispatchOverdue()
        .then((r) => {
          if (r.disabled) return;
          if (r.dispatched > 0 || r.skipped > 0) {
            this.logger.log(
              `超时自动派单：本批派 ${r.dispatched} 单，跳过 ${r.skipped} 单`,
            );
          }
        })
        .catch((e) => this.logger.error('超时自动派单失败', e));
    }, scanMs);
    this.logger.log(`超时自动派单扫描已启动，间隔 ${scanMs}ms`);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
