import { ChatDto } from '../../../actors/chats/dto/chat-dto';
import { SimpleChatPrompt } from '../../../actors/prompts/prompts.service';
import { toJSON } from '../../../utils';
import { AbsToolPlugin } from '../abstract-tool';

/** convert text to json, result into `data` */
export class JsonTool extends AbsToolPlugin {
  /** json[:array] */
  protocol() {
    return 'json';
  }

  /**
   * @param chatPrompt #prompt as json schema, may null.
   */
  async _invoke(chatDto: ChatDto, chatPrompt: SimpleChatPrompt) {
    const array = this._parseTo(chatPrompt.to);
    try {
      const txt = this._getRequestData(chatDto, chatPrompt, false);
      chatDto.data = toJSON(txt, array);
    } catch (err) {
      ChatDto.error(
        chatDto,
        400,
        'FAIL to parse JSON: ' + err.message,
        chatPrompt,
      );
    }

    if (chatPrompt.promptString) {
      // FIXME: schema validation. auto correction, based on LLM
    }

    return chatDto;
  }
  protected _parseTo(to: string) {
    return to.trim() == 'json:array';
  }
}
