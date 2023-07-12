import { ChatDto } from '../../../actors/chats/dto/chat-dto';
import { SimpleChatPrompt } from '../../../actors/prompts/prompts.service';
import { AbsToolPlugin } from '../abstract-tool';

/** evaluate prompt into req */
export class ErrorTool extends AbsToolPlugin {
  /** eval[:data] */
  protocol() {
    return 'error';
  }

  async _invoke(chatDto: ChatDto, chatPrompt: SimpleChatPrompt) {
    const { code } = this._parseTo(chatPrompt.to);
    chatDto.statusCode || (chatDto.statusCode = code || 500);
    chatDto.message || (chatDto.message = chatPrompt.promptString);
    return chatDto;
  }

  protected _parseTo(to: string) {
    const code = parseInt(to.substring(6));
    return { code };
  }
}
