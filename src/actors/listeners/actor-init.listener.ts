import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ActorsService } from '../../actors/actors.service';
import { ChatsService } from '../chats/chats.service';
import { ActorCreatedEvent } from '../../actors/events/actor-created.event';
import { ActorInitEvent } from '../../actors/events/actor-init.event';
import { ChatPrompt } from '../../hosts/vo/chat-prompt';
import { ChatDto } from '../chats/dto/chat-dto';
import { PromptsService } from '../prompts/prompts.service';
import { ActorStatus } from '../vo/actor-status.enum';
import { ActorBaseListener } from './actor-base.listener';

@Injectable()
export class ActorInitListener extends ActorBaseListener {
  constructor(
    chatsService: ChatsService,
    private readonly promptService: PromptsService,
    private readonly actorsService: ActorsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(chatsService);
  }

  @OnEvent(ActorInitEvent.eventName, { async: true })
  async onEvent(event: ActorInitEvent, eventCtx = {}) {
    await super.onHandleEvent(this.handleEvent, event, eventCtx);
  }

  /** init event, singleton ignore. */
  async handleEvent(event: ActorInitEvent, eventCtx = {}) {
    // TODO check eventCtx.initCnt, to avoid endless init.

    const { actor, host, status, data } = event;

    const ctx = await this.promptService.initContext(actor, true, data, true); // sync

    if (host.singleton) {
      this.actorsService.updateStatus(ActorStatus.ready, ctx);
      return;
    }
    this.actorsService.updateStatus(status, ctx);

    let resp = null;
    if (host.onInit) {
      resp = await this.promptService.process(
        actor,
        host.onInit as unknown as ChatPrompt,
        data,
        true,
      );
    }
    this.promptService.quickResponse(resp, async (v) => {
      return await this.postHandle(v, event, eventCtx);
    });
  }

  protected async postHandle(resp: ChatDto, event: ActorInitEvent, eventCtx) {
    const { actor, host } = event;
    this.eventEmitter.emit(
      ActorCreatedEvent.eventName,
      new ActorCreatedEvent(actor, host, resp),
      eventCtx,
    );
    return resp;
  }
}
