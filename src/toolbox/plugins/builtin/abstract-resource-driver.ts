import { Actor } from '@prisma/client';
import { ChatDto } from '../../../actors/chats/dto/chat-dto';
import {
  QuickResponse,
  SimpleChatPrompt,
} from '../../../actors/prompts/prompts.service';
import { ResourceConfig } from '../../../users/vo/resource-config';

export interface AbsResourceDriver {
  _invoke(
    config: ResourceConfig,
    chatDto: ChatDto,
    chatPrompt: SimpleChatPrompt,
    ctx: Record<string, any>,
    caller: Actor,
  ): Promise<QuickResponse<ChatDto>>;
}
