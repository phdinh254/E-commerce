import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { AppConfig, LoggerConfig } from '../../config/configuration';
import { createLoggerOptions } from './logger.config';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const appConfig = configService.get<AppConfig>('app') as AppConfig;
        const loggerConfig = configService.get<LoggerConfig>(
          'logger',
        ) as LoggerConfig;
        return createLoggerOptions(appConfig, loggerConfig);
      },
    }),
  ],
})
export class LoggerModule {}
