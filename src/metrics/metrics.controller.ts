// metrics.controller.ts
import { Controller, Get, Res } from '@nestjs/common';
import * as client from 'prom-client';
import type { Response } from 'express';

@Controller()
export class MetricsController {
  private readonly aggregatorRegistry = new client.AggregatorRegistry();

  @Get('/metrics')
  async metrics(@Res() res: Response) {
    try {
      const metrics = await this.aggregatorRegistry.clusterMetrics();

      res.set('Content-Type', client.register.contentType);
      res.send(metrics);
    } catch (err) {
      res.status(500).send(err);
    }
  }
}