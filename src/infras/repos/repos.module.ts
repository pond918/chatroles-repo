import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { PrismaModule } from 'nestjs-prisma';
// allow explicit queries/update for soft deleted records: deleted: true
import { APP_INTERCEPTOR } from '@nestjs/core';
import { providePrismaClientExceptionFilter } from 'nestjs-prisma';
import { createSoftDeleteMiddleware } from 'prisma-soft-delete-middleware';
import { EntityIdExistsRule } from '../validators/entity-exists.validator';
import {
  MemNamespacedStorage,
  NamespacedStorage,
} from './namespaced-storage.service';
import { ScopedStorageMan } from './scoped-storage.service';
import { PrismaTransactionScope } from './tx/prisma-tx-scope';

/** exported so to share with testing. */
export const mainPrismaServiceOptions = {
  middlewares: [
    // loggingMiddleware(),
    createSoftDeleteMiddleware({
      models: {
        Role: true,
        Host: true,
        Actor: true,
        User: true,
        MemoryNode: true,
        MemoryVersion: true,
      },
    }),
  ],
};

@Global()
@Module({
  imports: [
    PrismaModule.forRoot({
      isGlobal: true,
      prismaServiceOptions: mainPrismaServiceOptions,
    }),
    // TODO: redis https://docs.nestjs.com/techniques/caching#:~:text=%5B%0A%20%20%20%20CacheModule.-,register,-%3CRedisClientOptions%3E
    CacheModule.register({
      isGlobal: true,
      ttl: 2,
    }),
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor, // global controller get cache
    },
    providePrismaClientExceptionFilter(),
    EntityIdExistsRule,
    PrismaTransactionScope,
    {
      provide: NamespacedStorage,
      useClass: MemNamespacedStorage, // dev only
    },
    ScopedStorageMan,
  ],
  exports: [PrismaTransactionScope, ScopedStorageMan],
})
export class DbModule {}
