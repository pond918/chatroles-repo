import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { log } from 'console';
import { ChatDto } from '../../../../actors/chats/dto/chat-dto';
import {
  QuickResponse,
  SimpleChatPrompt,
} from '../../../../actors/prompts/prompts.service';
import { LLMsService } from '../../../../llms/llms.service';
import { ResourceConfig } from '../../../../users/vo/resource-config';
import { AbsDriverPlugin } from '../../abstract-driver';
import { AbsResourceDriver } from '../abstract-resource-driver';

/** all server/platform LLMs go here. */
@Injectable()
export class ServerLLMsDriver
  extends AbsDriverPlugin
  implements AbsResourceDriver
{
  constructor(
    protected readonly llmsService: LLMsService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  protocol() {
    return 'resource';
  }

  name() {
    return 'llm';
  }

  async _invoke(
    config: ResourceConfig,
    dto: ChatDto,
    chatPrompt: SimpleChatPrompt,
    ctx: Record<string, any>,
  ): Promise<QuickResponse<ChatDto>> {
    // choose llm bot to invoke
    const bot = this.llmsService.bot(config.url, ctx);
    if (!bot)
      return ChatDto.error(
        dto,
        404,
        'No llm bot found:' + config.url,
        chatPrompt,
      );

    // TODO message level config
    let ready = await bot.isAvailable();
    if (!ready) {
      if (typeof ready == 'boolean') ready = await bot.reloadSession();
      else {
        let props;
        if (config.runtime == 'platform') {
          // read llms platform config
          props = this.configService.get(
            'res.config.platform.llm.' + config.url,
          );
          if (props) props = JSON.parse(props);
        } else props = config.props;
        ready = await bot.initSession(props);
      }
    }
    if (!ready)
      return ChatDto.error(
        dto,
        503,
        'failed to init session for llm bot: ' + dto.options.model,
        chatPrompt,
      );

    // jest log
    log('>>>>>>>>>>>>>>>\n', dto.text);
    const resp = await bot.sendPrompt({ ...dto, options: { ...dto.options } });
    log('\n---------------\n', resp);
    delete (dto as any).id;
    dto.text = resp.text;
    // dto.options = { ...dto.options, ...resp.options };
    dto.statusCode = resp.statusCode || 0;
    dto.message = resp.message;
    dto.options.quotaTokens = resp.options.quotaTokens;

    return dto;
  }
}
