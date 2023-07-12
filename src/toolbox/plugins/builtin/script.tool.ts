import { Actor } from '@prisma/client';
import { ChatDto } from '../../../actors/chats/dto/chat-dto';
import {
  PromptsService,
  QuickResponse,
  SimpleChatPrompt,
} from '../../../actors/prompts/prompts.service';
import { toJSON } from '../../../utils';
import { AbsToolPlugin } from '../abstract-tool';
import { Injectable } from '@nestjs/common';
import { ChatPrompt } from '../../../hosts/vo/chat-prompt';
import { nanoid } from 'nanoid/async';

/** evaluate prompt into req text or data */
@Injectable()
export class ScriptTool extends AbsToolPlugin {
  constructor(protected readonly promptService: PromptsService) {
    super();
  }

  /** eval[:data] */
  protocol() {
    return 'script';
  }

  protected async interpolatePrompt() {
    // do nothing
  }

  async _invoke(
    chatDto: ChatDto,
    chatPrompt: SimpleChatPrompt,
    ctx: Record<string, any>,
    caller: Actor,
  ) {
    const scriptFunc = eval(`(${chatPrompt.promptString})`);
    chatDto = await scriptFunc(
      chatDto,
      {
        process: async (
          dto: ChatDto,
          prompt: ChatPrompt,
          callback?: (dto: ChatDto) => Promise<ChatDto>,
        ) => {
          if (dto.statusCode) return dto; // if error, no process

          let resp = await this.promptService.process(
            caller,
            prompt,
            dto,
            false,
          );
          if (callback && Array.isArray(resp)) {
            resp[0] = resp[0].then((v) => this._callback(v, callback));
            return resp;
          }
          if (Array.isArray(resp) || resp.statusCode < 0)
            resp = ChatDto.error(
              {
                ...(Array.isArray(resp) ? dto : resp),
                statusCode: 0,
                message: '',
              }, // clone fake dto
              -2,
              'ERROR async response is ongoing, BUT prompts after current IN SCRIPT will be ignored.',
              { ...prompt, promptString: undefined },
            ); // await lazy
          return callback ? callback(resp) : resp;
        },
        toJSON,
        uuid: nanoid,
      },
      ctx,
      caller,
    );
    return chatDto;
  }

  private async _callback(
    dto: QuickResponse<ChatDto>,
    callback: (dto: ChatDto) => Promise<ChatDto>,
  ) {
    if (Array.isArray(dto)) {
      dto[0] = dto[0].then((v) => this._callback(v, callback));
      return dto;
    }
    return callback(dto);
  }
}

export interface ScriptPromptService {
  /**
   * @param callback
   * @returns resp.statusCode == -1, means lazy response
   */
  process(
    dto: ChatDto,
    prompt: ChatPrompt,
    callback?: (dto: ChatDto) => Promise<ChatDto>,
  ): Promise<ChatDto>;
  /**
   * will strip content around the json, e.g.:
   *
   * text... {json:true} text......
   *
   * will result: {"json":true}
   */
  toJSON(text: string, isArray?: boolean): any;

  uuid(): Promise<string>;
}
