// https://dev.to/kenfdev/cross-module-transaction-with-prisma-5d08
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as cls from 'cls-hooked';
import { PrismaService } from 'nestjs-prisma';

export const PRISMA_CLIENT_KEY = '_prisma-client';

/** TODO use this: https://github.com/prisma/prisma-client-extensions/tree/main/callback-free-itx */
@Injectable()
export class PrismaTransactionScope {
  private readonly transactionContext: cls.Namespace;

  constructor(private readonly prisma: PrismaService) {
    const ns = cls.getNamespace('_transaction');
    this.transactionContext = ns || cls.createNamespace('_transaction');
  }

  /** MUST `await` every db operation inside `fn` code. */
  async run<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const prisma = this.transactionContext.get(
      PRISMA_CLIENT_KEY,
    ) as Prisma.TransactionClient;

    if (prisma) {
      return fn(prisma);
    } else {
      return this.prisma.$transaction(
        async (prisma) => {
          return this.transactionContext
            .runPromise(async () => {
              this.transactionContext.set(PRISMA_CLIENT_KEY, prisma);
              return fn(prisma);
            })
            .finally(() => {
              this.transactionContext.set(PRISMA_CLIENT_KEY, null);
            });
        },
        {
          timeout: 360000, // FIXME
        },
      );
    }
  }

  // /** set client for existing tx */
  // setClientIfNull(prisma: Prisma.TransactionClient) {
  //   const p = this.transactionContext.get(PRISMA_CLIENT_KEY);
  //   if (p) return;
  //   return this.transactionContext.runPromise(async () => {
  //     this.transactionContext.set(PRISMA_CLIENT_KEY, prisma);
  //   });
  // }

  getClient(): Prisma.TransactionClient {
    const prisma = this.transactionContext.get(
      PRISMA_CLIENT_KEY,
    ) as Prisma.TransactionClient;
    if (prisma) {
      return prisma;
    } else {
      return this.prisma;
    }
  }
}
