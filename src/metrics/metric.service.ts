import express from 'express';
import * as client from 'prom-client';

export async function startMetricsServer() {
  const app = express();

  const aggregatorRegistry = new client.AggregatorRegistry();

  app.get('/metrics', async (_req, res) => {
    try {
      const metrics = await aggregatorRegistry.clusterMetrics();

      res.set('Content-Type', client.register.contentType);

      res.send(metrics);
    } catch (err) {
      console.error(err);

      res.status(500).send(err);
    }
  });

  app.listen(9100, () => {
    console.log('Metrics server listening on :9100');
  });
}