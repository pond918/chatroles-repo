import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ChatsService } from '../chats/chats.service';
import { PreChatEvent } from '../chats/events/pre-chat.event';
import { PromptsService } from '../prompts/prompts.service';

/** prepare ctx into req */
@Injectable()
export class PreChatListener {
  constructor(
    chatsService: ChatsService,
    private readonly promptsService: PromptsService,
  ) {}

  // sync op to prepare ctx into req.
  @OnEvent(PreChatEvent.eventName, { async: false })
  async handleEvent(event: PreChatEvent) {
    const { actor, contextual, reqDto } = event;
    const ctx = await this.promptsService.initContext(
      actor,
      contextual,
      reqDto, // req must not null.
    );

    // update reqDto.options.maxQAs into ctx
    // await this.promptService.updateMaxQAs(reqDto.options?.maxQAs, ctx);

    return ctx;
  }
}
