import { ChatDto } from '../../../actors/chats/dto/chat-dto';
import { AbsToolPlugin } from '../abstract-tool';

/** send async event log to actor. */
export class LogTool extends AbsToolPlugin {
  protocol() {
    return 'log';
  }

  async _invoke(chatDto: ChatDto) {
    return chatDto;
  }
}
