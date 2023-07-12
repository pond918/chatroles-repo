import { BadRequestException, Injectable } from '@nestjs/common';
import { Actor } from '@prisma/client';
import { ChatDto } from '../../../actors/chats/dto/chat-dto';
import { SimpleChatPrompt } from '../../../actors/prompts/prompts.service';
import { AuthService } from '../../../infras/auth/auth.service';
import { QuotasService } from '../../../quotas/quotas.service';
import { UsersService } from '../../../users/users.service';
import { ResourceConfig } from '../../../users/vo/resource-config';
import { PluginProvider } from '../plugins-provider.service';
import { AbsResourceTool } from './abstract-resource-tool';

@Injectable()
export class LlmTool extends AbsResourceTool {
  constructor(
    readonly usersService: UsersService,
    readonly pluginProvider: PluginProvider,
    readonly authService: AuthService,
    readonly quotasService: QuotasService,
  ) {
    super(usersService, pluginProvider, authService, quotasService);
  }
  /**
   * supported params:
   * - `cost`, `quality` are suggested preference[0~2] to choose from users LLMs.
   * NOTE: when an llm is chosen, it'll not be changed for the actor lifetime.
   * @returns llm[:cost=0#quality=1]
   */
  protocol() {
    return 'llm';
  }

  async _invoke(
    chatDto: ChatDto,
    chatPrompt: SimpleChatPrompt,
    ctx: Record<string, any>,
    actor: Actor,
  ) {
    if (!chatPrompt.promptString) return chatDto; // nothing to say, just return req.
    chatDto.text = this._getRequestData(chatDto, chatPrompt, false);
    return super._invoke(chatDto, chatPrompt, ctx, actor);
  }

  protected async _selectUserConfig(
    llms: ResourceConfig[],
    chatPrompt: SimpleChatPrompt,
  ) {
    if (llms?.length <= 1) return llms?.length && llms[0];

    // [0~2], filter with `cost`/`quality`, < 0 matches all.
    const { cost, quality } = this._parseTo(chatPrompt.to);
    llms = llms.filter((l) => {
      let ret = cost < 0 || (l.props['cost'] || 0) <= cost;
      ret = ret && (quality < 0 || (l.props['quality'] || 0) <= quality);
      return ret;
    });

    if (llms?.length <= 1) return llms?.length && llms[0];

    // sort by `cost` desc, `quality` desc, `runtime`: server, local, platform
    llms.sort((a, b) => {
      let diff = (b.props['cost'] || 0) - (a.props['cost'] || 0);
      if (diff) return diff;
      diff = (b.props['quality'] || 0) - (a.props['quality'] || 0);
      if (diff) return diff;
      const ra = a.runtime == 'server' ? 0 : a.runtime == 'local' ? 1 : 2;
      const rb = b.runtime == 'server' ? 0 : b.runtime == 'local' ? 1 : 2;
      return ra - rb;
    });

    return llms[0];
  }

  protected _parseTo(to: string) {
    let [cost, quality] = [-1, -1];

    const sps = to.substring(4).split('#');
    for (const sp of sps) {
      const kv = sp.split('=');
      if (kv.length != 2) continue;
      switch (kv[0]) {
        case 'cost':
          cost = parseInt(kv[1]);
          break;
        case 'quality':
          quality = parseInt(kv[1]);
          break;
        default:
          throw new BadRequestException(`unknown parameter ${kv[0]} in ${to}`);
      }
    }

    return { cost, quality };
  }
}
