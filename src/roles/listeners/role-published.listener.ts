import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaTransactionScope } from '../../infras/repos/tx/prisma-tx-scope';
import { RolePublishingEvent } from '../events/role-publishing.event';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const logger = new Logger('RolePublishingListener');

/** generate/remove vdb embedding for publishing role */
@Injectable()
export class RolePublishingListener {
  constructor(
    private readonly configService: ConfigService,
    private readonly transactionScope: PrismaTransactionScope,
  ) {}

  @OnEvent(RolePublishingEvent.eventName, { prependListener: false })
  async handleEvent(event: RolePublishingEvent) {
    const { roleId, publishing } = event;
    if (!publishing) return;
    // save to db
    return this.transactionScope.run(async (prisma) => {
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (!role) return;

      const meta = { nick: role.nick };
      role.avatar && (meta['avatar'] = role.avatar);
      role.goal && (meta['goal'] = role.goal);
      axios
        .post(
          `${this.configService.get('API_CR_VDB')}/run/predict`,
          {
            data: [
              roleId,
              {
                meta,
                content: {
                  professionals: role.professionals,
                  goal: role.goal,
                  skills: role.skills,
                },
              },
            ],
          },
          {
            headers: {
              Authorization:
                'Bearer ' + this.configService.get('API_CR_VDB_TOKEN'),
            },
          },
        )
        .then((resp) => {
          logger.warn('vdb response', resp.status, resp.data);
        })
        .catch((err) => {
          logger.error('vdb error', err);
        });
    });
  }
}
