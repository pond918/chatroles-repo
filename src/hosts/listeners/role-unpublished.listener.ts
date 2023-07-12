import { BadRequestException, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RolePublishingEvent } from '../../roles/events/role-publishing.event';
import { HostsService } from '../hosts.service';

/** to unpublish role, requires no published host */
@Injectable()
export class RoleUnpublishedListener {
  constructor(private readonly hostsService: HostsService) {}

  @OnEvent(RolePublishingEvent.eventName, { async: false })
  async handleEvent(event: RolePublishingEvent) {
    const { roleId, publishing } = event;
    if (publishing) return;

    const host = await this.hostsService.findNewestByRoleId(roleId, true);
    if (host)
      throw new BadRequestException(
        'Cannot unpublish the role with published hosts.',
      );
  }
}
