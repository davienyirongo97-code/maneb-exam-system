import express from 'express';
import * as client from 'prom-client';

export async function startMetricsServer() {
  const app = express();

  const aggregatorRegistry =
    new client.AggregatorRegistry();

  app.get('/metrics', async (_req, res) => {
    try {

      console.log('metrics scrape started');

      const start = Date.now();

      const metrics =
        await aggregatorRegistry.clusterMetrics();

      console.log(
        `metrics scrape completed in ${
          Date.now() - start
        }ms`,
      );

      res.set(
        'Content-Type',
        aggregatorRegistry.contentType,
      );

      res.send(metrics);

    } catch (err) {

      console.error(err);

      res
        .status(500)
        .send('# metrics unavailable');
    }
  });

  app.listen(9100, () => {
    console.log(
      'Metrics server listening on :9100',
    );
  });
}