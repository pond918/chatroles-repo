import { Injectable, UnauthorizedException } from '@nestjs/common';
import { nanoid } from 'nanoid/async';
import { AuthService } from '../infras/auth/auth.service';
import { PrismaTransactionScope } from '../infras/repos/tx/prisma-tx-scope';
import { CreateQuotaDto } from './dto/create-quota.dto';

@Injectable()
export class QuotasService {
  constructor(
    private readonly transactionScope: PrismaTransactionScope,
    protected readonly authService: AuthService,
  ) {}

  async $getQuota(runtime: string, type: string, name: string) {
    const me = this.authService.currentActor();
    if (!me)
      throw new UnauthorizedException(
        `please login to access ${runtime} resource: ${type}:${name}.`,
      );
    return this.transactionScope.run(async (prisma) => {
      let quota = await prisma.quota.findUnique({
        where: {
          userId_runtime_type_name: {
            userId: me.id,
            runtime,
            type,
            name,
          },
        },
      });
      // reset quota if necessary
      if (
        (quota?.reset as any)?.length == 2 &&
        quota.invalidAt?.valueOf() < Date.now()
      ) {
        const [period, resetValue] = quota.reset as number[];
        if (period > 0 && resetValue > 0) {
          let invalidAt = quota.invalidAt.valueOf();
          do {
            invalidAt += period;
          } while (invalidAt < Date.now());
          quota.invalidAt = new Date(invalidAt);
          quota.quota = resetValue;
          quota = await prisma.quota.update({
            where: { id: quota.id },
            data: quota,
          });
        }
      }
      return quota;
    });
  }

  async $createQuota(quota: Required<CreateQuotaDto>) {
    const me = this.authService.currentActor();
    if (!me) throw new UnauthorizedException();
    return this.createQuota(me.id, quota);
  }

  async createQuota(userId: string, quota: Required<CreateQuotaDto>) {
    return this.transactionScope.run(async (prisma) => {
      return prisma.quota.create({
        data: {
          ...quota,
          userId,
          id: await nanoid(),
        },
      });
    });
  }

  async $updateQuota(
    quota: number,
    runtime: string,
    type: string,
    name: string,
  ) {
    return this.transactionScope.run(async (prisma) => {
      const me = this.authService.currentActor();
      if (!me)
        throw new UnauthorizedException(
          `please login to access ${runtime} resource: ${type}:${name}.`,
        );
      return prisma.quota.update({
        where: {
          userId_runtime_type_name: { userId: me.id, runtime, type, name },
        },
        data: { quota },
      });
    });
  }
}
