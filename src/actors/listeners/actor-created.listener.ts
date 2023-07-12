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
export class ActorCreatedListener extends ActorBaseListener {
  constructor(
    chatsService: ChatsService,
    private readonly promptService: PromptsService,
    private readonly actorsService: ActorsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(chatsService);
  }

  @OnEvent(ActorCreatedEvent.eventName, { async: true })
  async onEvent(event: ActorCreatedEvent, eventCtx = {}) {
    await super.onHandleEvent(this.handleEvent, event, eventCtx);
  }

  /** created event. if response not empty, will fire init again. */
  async handleEvent(event: ActorCreatedEvent, eventCtx = {}) {
    const { actor, host, data } = event;

    const ctx = await this.promptService.initContext(actor, true, data, true); // sync

    if (host.singleton) {
      await this.actorsService.updateStatus(ActorStatus.ready, ctx);
      return;
    }

    let resp = null;
    if (host.onCreated) {
      resp = await this.promptService.process(
        actor,
        host.onCreated as unknown as ChatPrompt,
        data,
        true,
      );
    }
    this.promptService.quickResponse(resp, async (v) => {
      return await this.postHandle(v, event, ctx, eventCtx);
    });
  }

  protected async postHandle(
    resp: ChatDto,
    event: ActorCreatedEvent,
    ctx: Record<string, any>,
    eventCtx,
  ) {
    const { actor, host, status } = event;
    // if any response from onCreated, fire init event again.
    if (resp) {
      if (!eventCtx['initCnt']) eventCtx['initCnt'] = 1;
      eventCtx['initCnt']++;

      this.eventEmitter.emit(
        ActorInitEvent.eventName,
        new ActorInitEvent(actor, host, resp),
        eventCtx,
      );
    } else {
      delete eventCtx['initCnt'];
      this.actorsService.updateStatus(status, ctx);
    }
    return resp;
  }
}
