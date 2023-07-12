import { Injectable } from '@nestjs/common';
import { Actor } from '@prisma/client';
import { ChatDto } from '../../../../actors/chats/dto/chat-dto';
import {
  QuickResponse,
  SimpleChatPrompt,
} from '../../../../actors/prompts/prompts.service';
import { EventTopic } from '../../../../sses/event-topics.enum';
import { SsesService } from '../../../../sses/sses.service';
import { ResourceConfig } from '../../../../users/vo/resource-config';
import { AbsDriverPlugin } from '../../abstract-driver';
import { AbsResourceDriver } from '../abstract-resource-driver';

/** all local LLM bot is same. */
@Injectable()
export class LocalResourceDriver
  extends AbsDriverPlugin
  implements AbsResourceDriver
{
  constructor(private readonly ssesService: SsesService) {
    super();
  }

  protocol() {
    return 'resource';
  }

  name() {
    return 'local';
  }

  async _invoke(
    config: ResourceConfig,
    dto: ChatDto,
    chatPrompt: SimpleChatPrompt,
    ctx: Record<string, any>,
    actor: Actor,
  ): Promise<QuickResponse<ChatDto>> {
    dto.options.model = config.url;

    const eventTopic = EventTopic[config.type];
    if (!eventTopic)
      ChatDto.error(dto, 400, 'unsupported local resource type:' + config.type);
    console.log('SSE sending....' + eventTopic);
    const event = this.ssesService.emit({ payload: dto }, eventTopic, actor);

    if (!event)
      // client not online, cannot perform the action.
      return ChatDto.error(
        dto,
        404,
        'ERROR: local resource unavailable' + eventTopic,
        chatPrompt,
      );

    try {
      const promise = this.ssesService.onResponse(event.id, actor);
      // TODO handle error: promise.catch((reason) => {});

      const resp = await promise;
      dto = resp[0];
      delete dto.options?.model;
      return dto;
    } catch (err) {
      if (err.message?.indexOf('timeout') >= 0)
        return ChatDto.error(dto, 504, 'ERROR: local LLM timeout', chatPrompt);
      throw err;
    }
  }
}
