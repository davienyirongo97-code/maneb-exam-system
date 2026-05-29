import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AppClusterService } from './main.cluster';

async function bootstrap() {

  const app = await NestFactory.create(AppModule);

  const server = app.getHttpServer();

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  app.enableCors({
    origin: '*',
    methods:
      'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      disableErrorMessages: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(3000, '0.0.0.0');
}

AppClusterService.clusterize(bootstrap);