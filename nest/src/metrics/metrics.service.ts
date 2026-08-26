import { Injectable } from '@nestjs/common';
import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry: Registry;
  private readonly httpReqTotal: Counter<string>;
  private readonly httpReqDuration: Histogram<string>;

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry });

    this.httpReqTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpReqDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
      registers: [this.registry],
    });
  }

  observe(method: string, route: string, status: number, durationSec: number) {
    const labels = { method, route, status: String(status) };
    this.httpReqTotal.inc(labels);
    this.httpReqDuration.observe(labels, durationSec);
  }

  async metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
