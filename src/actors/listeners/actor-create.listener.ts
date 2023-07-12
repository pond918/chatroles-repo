import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ActorsService } from '../../actors/actors.service';
import { ChatsService } from '../chats/chats.service';
import { ActorCreateEvent } from '../../actors/events/actor-create.event';
import { ActorInitEvent } from '../../actors/events/actor-init.event';
import { ChatPrompt } from '../../hosts/vo/chat-prompt';
import { HostMember } from '../../hosts/vo/host-member';
import { ChatDto } from '../chats/dto/chat-dto';
import { PromptsService } from '../prompts/prompts.service';
import { ActorStatus } from '../vo/actor-status.enum';
import { ActorBaseListener } from './actor-base.listener';

/** call onCreate prompt. then create members if necessary */
@Injectable()
export class ActorCreateListener extends ActorBaseListener {
  constructor(
    chatsService: ChatsService,
    private readonly promptService: PromptsService,
    private readonly actorsService: ActorsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(chatsService);
  }

  // create handle is sync op
  @OnEvent(ActorCreateEvent.eventName, { async: false })
  async onEvent(event: ActorCreateEvent, eventCtx = {}) {
    return super.onHandleEvent(this.handleEvent, event, eventCtx);
  }

  /** create event, singleton ignore. fire early members creation. */
  async handleEvent(event: ActorCreateEvent, eventCtx: object) {
    const { actor, host, status, data } = event;
    // init longrun creation ctx.
    const ctx = await this.promptService.initContext(
      actor,
      true,
      data,
      true,
      true,
    ); // sync

    if (!host || host.singleton) {
      await this.actorsService.updateStatus(ActorStatus.ready, ctx);
      return;
    }

    const curStatus = await this.actorsService.getStatus(ctx);
    if (curStatus)
      throw new BadRequestException(
        `Cannot create actor#${actor.id} with status#${curStatus}, only empty status allowed.`,
      );
    await this.actorsService.updateStatus(status, ctx);

    let resp = null;
    if (host.onCreate) {
      resp = await this.promptService.process(
        actor,
        host.onCreate as unknown as ChatPrompt,
        data,
        true,
      );
    }
    this.promptService.quickResponse(resp, async (v) => {
      return await this.postHandle(v, event, eventCtx);
    });
  }

  protected async postHandle(
    resp: ChatDto,
    event: ActorCreateEvent,
    eventCtx,
  ): Promise<ChatDto> {
    const { actor, host } = event;
    // async
    this.eventEmitter.emit(
      ActorInitEvent.eventName,
      new ActorInitEvent(actor, host, resp),
      eventCtx,
    );
    // early create members.
    const members = host.members as unknown as HostMember[];
    members?.forEach(async (member) => {
      // async create
      if (member.earlyCreate) this.actorsService.createMember(actor, member);
    });
    return resp;
  }
}
