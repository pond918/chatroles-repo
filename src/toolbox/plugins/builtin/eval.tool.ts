import { ChatDto } from '../../../actors/chats/dto/chat-dto';
import { SimpleChatPrompt } from '../../../actors/prompts/prompts.service';
import { toJSON } from '../../../utils';
import { AbsToolPlugin } from '../abstract-tool';

/** evaluate prompt into req text or data */
export class EvalTool extends AbsToolPlugin {
  /** eval[:data] */
  protocol() {
    return 'eval';
  }

  async _invoke(chatDto: ChatDto, chatPrompt: SimpleChatPrompt) {
    const toData = chatPrompt.to == 'eval:data';

    if (toData) chatDto.data = toJSON(chatPrompt.promptString);
    else
      chatDto.text = chatPrompt.promptString
        ? chatPrompt.promptString.toString()
        : null;
    return chatDto;
  }
}
