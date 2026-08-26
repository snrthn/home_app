import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime();
    res.on('finish', () => {
      const [seconds, nanos] = process.hrtime(start);
      const duration = seconds + nanos / 1e9;
      const route = req.route?.path || req.url;
      this.metrics.observe(req.method, route, res.statusCode, duration);
    });
    next();
  }
}
