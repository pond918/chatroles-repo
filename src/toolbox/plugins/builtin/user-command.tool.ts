import { Injectable } from '@nestjs/common';
import { Actor } from '@prisma/client';
import { ChatDto } from '../../../actors/chats/dto/chat-dto';
import {
  PromptsService,
  QuickResponse,
  SimpleChatPrompt,
} from '../../../actors/prompts/prompts.service';
import { AbsToolPlugin } from '../abstract-tool';

type CommandSession = {
  cmdChatDto: ChatDto;
  resolve: (v: ChatDto) => void;
  reject: (v: ChatDto) => void;
};

/**
 * for user to invoke tool plugins directly:
 * - must firstly call `user-command#start` to enter COMMAND MODE, prepare req:chatDto into an **actor's** ctx;
 * - then call `user-command#run prompt` to invoke a tool plugin, with ctx req;
 * - lastly call `user-command#end` to finish user-command MODE.
 *
 * multiple `user-command#start` call on same actor, will be queued, processing in FIFO order.
 */
@Injectable()
export class UserCommandTool extends AbsToolPlugin {
  constructor(protected readonly promptService: PromptsService) {
    super();
  }

  /** user-command:(start|run|end) */
  protocol() {
    return 'user-command';
  }

  /** FIFO queue */
  protected readonly _SESSION_LIST: CommandSession[] = [];

  async _invoke(
    chatDto: ChatDto,
    chatPrompt: SimpleChatPrompt,
    ctx: Record<string, any>,
    caller: Actor,
  ) {
    const phase = this._parseTo(chatPrompt.to);
    switch (phase) {
      case 'start': // start user-command mode.
        // prepare subject request into context
        const resp: QuickResponse<ChatDto> = [
          new Promise<ChatDto>((resolve, reject) => {
            if (chatDto.options.resolve) {
              chatDto.options.resolve(chatDto);
              delete chatDto.options.resolve;
            }
            this._SESSION_LIST.push({ cmdChatDto: chatDto, resolve, reject });
          }),
          chatDto,
        ];
        return resp;
      case 'run': // run ChatPrompt command, with subject request
        if (!this._SESSION_LIST.length)
          return ChatDto.error(
            chatDto,
            405,
            'need to call `user-command:start` to enter command mode.',
            chatPrompt,
          );

        // forward command to ChatPrompt,
        const { cmdChatDto: theDto } = this._SESSION_LIST.at(-1); // FILO
        return this.promptService.process(caller, chatDto.data, theDto);
      case 'end':
        // finish user-command mode
        const { cmdChatDto, resolve, reject } = this._SESSION_LIST.pop(); // FILO

        // end with req data
        let data = this._getRequestData(chatDto, chatPrompt, true);
        typeof data == 'undefined' || (cmdChatDto.data = data);
        data = this._getRequestData(chatDto, chatPrompt, false);
        typeof data == 'undefined' || (cmdChatDto.text = data);
        // request status code
        chatDto.statusCode && (cmdChatDto.statusCode = chatDto.statusCode);

        resolve(cmdChatDto); // send subject as resp
        // get/return final result of the promise chain here,
        chatDto = await new Promise<ChatDto>(
          (resolve1) => (cmdChatDto.options.resolve = resolve1),
        );
        delete cmdChatDto.options.resolve;
        return chatDto;
        if (false) reject(null); // TODO support reject?
      default:
        return ChatDto.error(
          chatDto,
          400,
          'invalid to address: ' + chatPrompt.to,
          chatPrompt,
        );
    }
  }

  protected _parseTo(to: string) {
    return to.substring(13);
  }
}
