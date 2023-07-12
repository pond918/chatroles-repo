import { Actor } from '@prisma/client';
import { ChatDto } from '../../actors/chats/dto/chat-dto';
import {
  QuickResponse,
  SimpleChatPrompt,
} from '../../actors/prompts/prompts.service';
import { templiteAsync } from '../../infras/libs/templite';
import { toJSON } from '../../utils';

export interface IPlugin {
  /** plugin name */
  pname(): string;
}

/**
 * tools are all invocable facilities. ToolPlugin mus be STATELESS.
 */
export abstract class AbsToolPlugin implements IPlugin {
  pname() {
    return this.protocol();
  }

  /** supported protocol */
  abstract protocol(): string;

  /**
   * @returns result | promise of result if maxQAs exceeds
   */
  abstract _invoke(
    chatDto: ChatDto,
    chatPrompt: SimpleChatPrompt,
    ctx: Record<string, any>,
    caller: Actor,
  ): Promise<QuickResponse<ChatDto>>;

  /** interpolate prompt string then invoke plugin */
  async invoke(
    req: ChatDto,
    chatPrompt: SimpleChatPrompt,
    ctx: Record<string, any>,
    caller: Actor,
  ): Promise<QuickResponse<ChatDto>> {
    let resp: QuickResponse<ChatDto>;
    try {
      await this.interpolatePrompt(chatPrompt, ctx);
      resp = await this._invoke(req, chatPrompt, ctx, caller);
    } catch (err) {
      // console.error(err);
      resp = ChatDto.error(req, 400, `Error: ${err.message}`, chatPrompt);
    }
    return resp;
  }

  /** interpolate template string, e.g.: 'txt <<a.1.b.0.c>>' */
  protected async interpolatePrompt(chatPrompt: SimpleChatPrompt, ctx: object) {
    if (!chatPrompt.promptString) return;
    chatPrompt.promptString = await this.interpolate(
      chatPrompt.promptString,
      ctx,
    );
    if (typeof chatPrompt.promptString != 'string') {
      chatPrompt.promptString = JSON.stringify(chatPrompt.promptString);
      chatPrompt.isJson = true;
    }
  }

  /** interpolate template string, e.g.: 'txt <<a.1.b.0.c>>' */
  protected async interpolate(template: string, ctx: object) {
    return template && (await templiteAsync(template, ctx));
  }

  /**
   * @param json if null, return json || promptString || text || data
   */
  protected _getRequestData(
    chatDto: ChatDto,
    chatPrompt: SimpleChatPrompt,
    json: boolean | null = null,
  ) {
    if (json === true)
      return chatPrompt.isJson ? toJSON(chatPrompt.promptString) : chatDto.data;
    if (json === false)
      return (
        (!chatPrompt.isJson &&
          typeof chatPrompt.promptString !== 'undefined' &&
          chatPrompt.promptString) ||
        chatDto.text
      );

    return (
      (chatPrompt.isJson && toJSON(chatPrompt.promptString)) ||
      (typeof chatPrompt.promptString != 'undefined' &&
        chatPrompt.promptString) ||
      chatDto.text ||
      chatDto.data
    );
  }
}
