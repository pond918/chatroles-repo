import { Injectable } from '@nestjs/common';
import { Actor } from '@prisma/client';
import jexl from '@digifi/jexl';
import { ChatDto } from '../../../actors/chats/dto/chat-dto';
import {
  PromptsService,
  SimpleChatPrompt,
} from '../../../actors/prompts/prompts.service';
import { AbsToolPlugin } from '../abstract-tool';

/** iterate chatDto.data[chatPrompt.prompt]. result is set to chatDto.data directly. */
@Injectable()
export class IteratorTool extends AbsToolPlugin {
  /** iterator[:flat#<<equals_expression>>] */
  protocol() {
    return 'iterator';
  }

  constructor(private readonly promptsService: PromptsService) {
    super();
  }

  /** do not interpolate the prompt, treat it as json expression. */
  protected async interpolatePrompt() {
    // do nothing
  }

  async _invoke(
    req: ChatDto,
    chatPrompt: SimpleChatPrompt,
    ctx: Record<string, any>,
    caller: Actor,
  ) {
    const { flat, merge } = this.parseTo(chatPrompt.to);

    let array: any = req.data;
    try {
      if (chatPrompt.promptString) {
        if (chatPrompt.isJson)
          throw new Error('prompt must be a path name string.');
        array = jexl.evalSync(chatPrompt.promptString, array);
      }
      if (!Array.isArray(array)) throw new Error('data must be an array.');
    } catch (err) {
      return ChatDto.error(
        req,
        400,
        `[iterator] Error ${chatPrompt.promptString}: ` + err.message,
        chatPrompt,
      );
    }
    // iterate array, call responses, then collect results
    const result = [];
    await this.processItems(result, flat, array, req, chatPrompt, ctx, caller);
    req.data = result;
    chatPrompt.responses = null; // parent need not process responses anymore
    if (merge && result?.length) {
      const os = [],
        set = new Set();
      for (const o of result) {
        const key = super.interpolate(merge, o);
        if (set.has(key)) continue;
        set.add(key);
        os.push(o);
      }
      req.data = os;
    }
    return req;
  }

  protected parseTo(to: string) {
    let flat, merge;
    const idx = to.indexOf(':');
    if (idx > 0) {
      to = to.substring(idx + 1);
      const strs = to.split('#');
      for (const s of strs) {
        if (s == 'flat') flat = 1;
        else if (s?.startsWith('<<') && s?.endsWith('>>')) merge = s;
      }
    }
    return { flat, merge };
  }

  protected async processItems(
    result: any[],
    flat: boolean,
    array: any[],
    req: ChatDto,
    chatPrompt: SimpleChatPrompt,
    ctx: Record<string, any>,
    caller: Actor,
  ) {
    if (!array?.length) return result;
    return await this.processItem(
      0,
      result,
      flat,
      array,
      req,
      chatPrompt,
      ctx,
      caller,
    );
  }

  protected async processItem(
    idx: number,
    result: any[],
    flat: boolean,
    array: any,
    req: ChatDto,
    chatPrompt: SimpleChatPrompt,
    ctx: Record<string, any>,
    caller: Actor,
  ) {
    if (idx >= array.length) return result;

    // call responses
    const item = array[idx];
    const req1 = { ...req, data: item };
    const resp = await this.promptsService.handleResponseRules(
      caller,
      chatPrompt,
      null,
      { idx: 0, resp: req1 },
      ctx,
    );

    // next item.
    return await this.promptsService.quickResponse(resp, (resp: ChatDto) => {
      if (resp.statusCode) return resp; // stop iterate

      if (resp.data) {
        flat && Array.isArray(resp.data)
          ? result.push(...resp.data)
          : result.push(resp.data);
      }
      return this.processItem(
        idx + 1,
        result,
        flat,
        array,
        req,
        chatPrompt,
        ctx,
        caller,
      );
    });
  }
}
