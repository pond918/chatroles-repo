import { Injectable, NotFoundException } from '@nestjs/common';
import { Actor } from '@prisma/client';
import { ActorsService } from '../../../actors/actors.service';
import { ChatsService } from '../../../actors/chats/chats.service';
import { ChatDto } from '../../../actors/chats/dto/chat-dto';
import { SimpleChatPrompt } from '../../../actors/prompts/prompts.service';
import { HostsService } from '../../../hosts/hosts.service';
import { HostMember } from '../../../hosts/vo/host-member';
import { AbsToolPlugin } from '../abstract-tool';
import { toJSON } from '../../../utils';

/** get/init actor member, it may not be ready. */
@Injectable()
export class ActorTool extends AbsToolPlugin {
  constructor(
    private readonly actorsService: ActorsService,
    private readonly hostsService: HostsService,
    private readonly chatsService: ChatsService,
  ) {
    super();
  }

  /** @[memberName][#entryName], memberName empty means self */
  protocol() {
    return '@';
  }

  async _invoke(
    reqDto: ChatDto,
    chatPrompt: SimpleChatPrompt,
    ctx: Record<string, any>,
    caller: Actor,
  ) {
    if (chatPrompt.responses?.length)
      return ChatDto.error(
        reqDto,
        400,
        'actor entry cannot process chatPrompt.responses',
        chatPrompt,
      );
    if (typeof chatPrompt.promptString !== 'undefined') {
      if (chatPrompt.isJson) reqDto.data = toJSON(chatPrompt.promptString);
      else reqDto.text = chatPrompt.promptString;
    }

    const { memberNames, entry } = this.parseTo(chatPrompt.to);

    let member = caller;
    for (const memberName of memberNames) {
      member = await this.loadMemberActor(memberName, member, reqDto);
      if (!member)
        return ChatDto.error(
          reqDto,
          404,
          `no member "${memberName}" found in ${chatPrompt.to}`,
          chatPrompt,
        );
    }
    const ctxId = await ctx.id;
    const resp = this.chatsService.chatEntry(member, !!ctxId, reqDto, entry);
    return resp;
  }

  async loadMemberActor(memberName: string, caller: Actor, reqDto: ChatDto) {
    let member = caller;
    if (memberName) {
      if (memberName == 'parent')
        member = await this.actorsService.findOne(caller.parentId);
      else member = await this.actorsService.findMember(caller.id, memberName);
    }
    // create actor.
    if (!member) {
      const host = await this.hostsService.findOne(caller.hostId);
      const members = host?.members as unknown as HostMember[];
      const hostMember = members?.find((m) => m.name == memberName);
      if (!hostMember) return null;
      // TODO cost maxQAs..
      member = await this.actorsService.createMember(
        caller,
        hostMember,
        reqDto,
      );
    }
    return member;
  }

  protected parseTo(to: string): { memberNames: string[]; entry: string } {
    let memberNames = to.substring(1),
      entry = '';

    const idx = memberNames.indexOf('#');
    if (idx >= 0) {
      entry = memberNames.substring(idx + 1);
      memberNames = memberNames.substring(0, idx);
    }

    return { memberNames: memberNames.split('@'), entry };
  }
}
