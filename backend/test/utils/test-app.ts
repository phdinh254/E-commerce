import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TestingModuleBuilder } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { RequestIdMiddleware } from '../../src/common/middleware/request-id.middleware';

export async function createTestApp(
  /** Escape hatch for e.g. overriding STORAGE_PROVIDER with a fake adapter
   * (no real Supabase test project/credential is available — see
   * test/utils/fake-storage.provider.ts and the Chapter 11 report). */
  configureModule: (builder: TestingModuleBuilder) => TestingModuleBuilder = (
    builder,
  ) => builder,
): Promise<INestApplication> {
  const moduleRef: TestingModule = await configureModule(
    Test.createTestingModule({ imports: [AppModule] }),
  ).compile();

  const app = moduleRef.createNestApplication({ bufferLogs: true });
  app.useLogger(app.get(Logger));
  const requestIdMiddleware = new RequestIdMiddleware();
  app.use(requestIdMiddleware.use.bind(requestIdMiddleware));
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.init();
  return app;
}
