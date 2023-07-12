import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { UserCreatedEvent } from '../events/user-created.event';
import { ResourceConfig } from '../vo/resource-config';
import { QuotasService } from '../../quotas/quotas.service';

/** init platform resource quota */
@Injectable()
export class UserCreatedListener {
  constructor(
    protected configService: ConfigService,
    protected quotasService: QuotasService,
  ) {}

  @OnEvent(UserCreatedEvent.eventName)
  async handleEvent(event: UserCreatedEvent) {
    const { user } = event;
    if (!user.realm || user.realm == 'local') return;

    // add resource quota to newly registered user
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    (user.resConfigs as unknown as ResourceConfig[])?.map((c) => {
      if (c.runtime != 'platform') return;

      const conf = this.configService.get<string>(
        `res.config.platform.${c.type}.${c.name}`,
      );
      if (!conf) return;

      const json = JSON.parse(conf);
      // [period in ms, quota value]
      if (json?.quota?.length != 2) return;

      this.quotasService.createQuota(user.id, {
        ...c,
        quota: json[1],
        invalidAt: today,
        reset: json.quota,
      });
    });
  }
}
