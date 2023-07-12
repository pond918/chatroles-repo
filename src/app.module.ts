import { classes } from '@automapper/classes';
import { AutomapperModule } from '@automapper/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ClsModule } from 'nestjs-cls';
import { ActorsModule } from './actors/actors.module';
import { HostsModule } from './hosts/hosts.module';
import { AuthModule } from './infras/auth/auth.module';
import { DtosModule } from './infras/dto/dtos.module';
import { DbModule } from './infras/repos/repos.module';
import { ValidatorModule } from './infras/validators/validator.module';
import { LLMsModule } from './llms/llms.module';
import { MemoryModule } from './memory-nodes/memory.module';
import { ToolsModule } from './toolbox/tools.module';
import { QuotasModule } from './quotas/quotas.module';
import { RolesModule } from './roles/roles.module';
import { SsesModule } from './sses/sses.module';
import { UsersModule } from './users/users.module';
// import { HealthModule } from './health/health.module';
import { LoggingInterceptor } from '@algoan/nestjs-logging-interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

export const jwtSecret = process.env.JWT_SECRET;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env' + (process.env.profile || '.dev'), '.env'],
    }),
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true, // RequestId tracking.
        // setup: (cls: ClsService, req: any, res: any) => {},
      },
    }),
    EventEmitterModule.forRoot(),
    AutomapperModule.forRoot({
      strategyInitializer: classes(),
    }),
    DtosModule,
    DbModule,
    ValidatorModule,
    RolesModule,
    ActorsModule,
    UsersModule,
    HostsModule,
    ToolsModule,
    SsesModule,
    // HealthModule,
    MemoryModule,
    AuthModule,
    LLMsModule,
    QuotasModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
