import { Injectable } from '@nestjs/common';
import { Actor } from '@prisma/client';
import { ChatDto } from '../../../actors/chats/dto/chat-dto';
import { SimpleChatPrompt } from '../../../actors/prompts/prompts.service';
import { RolesService } from '../../../roles/roles.service';
import { AbsToolPlugin } from '../abstract-tool';
import { HostsService } from '../../../hosts/hosts.service';

@Injectable()
export class RoleTool extends AbsToolPlugin {
  constructor(
    private readonly rolesService: RolesService,
    private readonly hostsService: HostsService,
  ) {
    super();
  }

  /** role */
  protocol() {
    return 'role';
  }

  async _invoke(
    reqDto: ChatDto,
    chatPrompt: SimpleChatPrompt,
    ctx: Record<string, any>,
    caller: Actor,
  ) {
    const role = await this.rolesService.findOne(caller.roleId);
    reqDto.data = {
      role: { goal: role.goal, professionals: role.professionals },
    };

    const { method } = this.parseTo(chatPrompt.to);
    switch (method) {
      case 'members':
        const host = await this.hostsService.findOne(caller.hostId);
        if (host.members?.length) reqDto.data.members = host.members;
        break;
      case 'entries':
        reqDto.data.role.entries = role.entries?.map((e) => {
          delete e.schema;
          return e;
        });
        break;
    }

    return reqDto;
  }

  protected parseTo(to: string) {
    const idx = to.indexOf(':');
    return { method: idx > 0 ? to.substring(idx + 1) : '' };
  }
}
