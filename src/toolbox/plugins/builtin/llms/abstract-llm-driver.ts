import { Actor } from '@prisma/client';
import { ChatDto } from '../../../../actors/chats/dto/chat-dto';
import { ResourceConfig } from '../../../../users/vo/resource-config';
import { AbsDriverPlugin } from '../../abstract-driver';

export type LlmRequest = Omit<
  ChatDto,
  'data' | 'statusCode' | 'options.maxQAs'
> & {
  lastMsgId: string;
  options?: Record<string, any>;
};
export type LlmResponse = Omit<ChatDto, 'options.maxQAs'>;

export abstract class LlmDriver extends AbsDriverPlugin {
  protocol() {
    return 'llm';
  }

  /** send req with parentMsgId. store response.id as new parentMsgId. */
  abstract send(
    req: LlmRequest,
    config: ResourceConfig,
    actor: Actor,
  ): Promise<LlmResponse>;
}
