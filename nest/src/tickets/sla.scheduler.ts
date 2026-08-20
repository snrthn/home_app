import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { TicketsService } from './tickets.service';

/**
 * SLA 自动升级扫描器（docs/complaints-tickets-design.md §4）。
 * 因沙箱无法安装 @nestjs/schedule，此处用 setInterval 实现等价的定时任务：
 * 每 SLA_SCAN_MS（默认 5 分钟）扫描一次活跃工单，超时则升级、改派、留内部备注并广播。
 * escalateDue() 内部已做幂等（escalatedFirstResponse / escalatedResolve 标记位）。
 */
@Injectable()
export class SlaSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlaSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly tickets: TicketsService) {}

  onModuleInit() {
    const intervalMs = Number(process.env.SLA_SCAN_MS ?? 5 * 60 * 1000);
    this.timer = setInterval(() => {
      this.tickets
        .escalateDue()
        .then((due) => {
          if (due && due.length) {
            this.logger.log(`SLA 升级扫描：本批升级 ${due.length} 单`);
          }
        })
        .catch((e) => this.logger.error('SLA 升级扫描失败', e));
    }, intervalMs);
    this.logger.log(`SLA 自动升级扫描已启动，间隔 ${intervalMs}ms`);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
