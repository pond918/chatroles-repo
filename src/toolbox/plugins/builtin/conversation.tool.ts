import { ChatDto } from '../../../actors/chats/dto/chat-dto';
import { AbsToolPlugin } from '../abstract-tool';

/** send async event log to actor. */
export class ConversationTool extends AbsToolPlugin {
  protocol() {
    return 'conversation';
  }

  async _invoke(chatDto: ChatDto) {
    // FIXME
    return chatDto;
  }
}
