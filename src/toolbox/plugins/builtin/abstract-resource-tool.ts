import { BadRequestException } from '@nestjs/common';
import { Actor, Quota } from '@prisma/client';
import { ChatDto } from '../../../actors/chats/dto/chat-dto';
import {
  QuickResponse,
  SimpleChatPrompt,
} from '../../../actors/prompts/prompts.service';
import { AuthService } from '../../../infras/auth/auth.service';
import { UserDto } from '../../../users/dto/user.dto';
import { UsersService } from '../../../users/users.service';
import { ResourceConfig } from '../../../users/vo/resource-config';
import { AbsToolPlugin } from '../abstract-tool';
import { PluginType } from '../plugins-loader.module';
import { PluginProvider } from '../plugins-provider.service';
import { AbsResourceDriver } from './abstract-resource-driver';
import { LocalResourceDriver } from './llms/local.resource.driver';
import { QuotasService } from '../../../quotas/quotas.service';

/**
 * user resource tool plugin. a resource is made up of:
 * - protocol: represent a category of resources, with same functionality
 * - address: point to an actual resource
 * - token: user auth token or uname/pwd pair to setup a session to the resource service
 * - runtime: 3 types service client runtime: local, server, platform
 *   - local: calling service from user client, through SSE, using user's token
 *   - server: calling service from Chat-Roles server, using user's token
 *   - platform: calling service, using , using Chat-Roles' token
 *
 * protocol is specified in role host definition. address/token/runtime are configs from user.
 */
export abstract class AbsResourceTool extends AbsToolPlugin {
  constructor(
    protected readonly usersService: UsersService,
    protected readonly pluginProvider: PluginProvider,
    protected readonly authService: AuthService,
    protected readonly quotasService: QuotasService,
  ) {
    super();
  }

  async _invoke(
    chatDto: ChatDto,
    chatPrompt: SimpleChatPrompt,
    ctx: Record<string, any>,
    actor: Actor,
  ): Promise<QuickResponse<ChatDto>> {
    // 1. read config from user.
    const config = await this._getResourceConfig(chatPrompt, ctx);

    // 2. driver to invoke the resource
    const driver = this._getResourceDriver(config);

    if (!driver)
      return ChatDto.error(
        chatDto,
        404,
        'unsupported resource: no resource driver found,' + chatPrompt.to,
        chatPrompt,
      );

    // 3. load platform quota
    let quota: Quota,
      resQuota = chatDto.options.quotaTokens;
    if (config.runtime == 'platform') {
      quota = await this.quotasService.$getQuota(
        config.runtime,
        config.type,
        config.name,
      );
      if (quota) {
        if (quota.quota <= 0 || quota.invalidAt?.getTime() < Date.now()) {
          return ChatDto.error(
            chatDto,
            402,
            `quota exceeds for platform resource ${chatPrompt.to}:${config.name}`,
          );
        }
        chatDto.options.quotaTokens = resQuota = quota.quota;
      }
    }

    // 4. invoke driver, session pool is maintained inside driver.
    chatDto.options.config_props = config.props;
    const resp = await driver._invoke(config, chatDto, chatPrompt, ctx, actor);
    if (!Array.isArray(resp)) {
      if (resp.options?.config_props) {
        config.props = { ...config.props, ...resp.options?.config_props };
        delete chatDto.options.config_props;
        // save local config bind
        const _bindConfigKey = this._getActorBoundCtxKey(chatPrompt);
        ctx[_bindConfigKey] = config;
      }
    } // FIXME if is array

    // 5. update platform quota
    if (quota && resQuota != chatDto.options.quotaTokens) {
      this.quotasService.$updateQuota(
        chatDto.options.quotaTokens,
        config.runtime,
        config.type,
        config.name,
      );
    }

    return resp;
  }

  protected _getActorBoundCtxKey(chatPrompt: SimpleChatPrompt) {
    return 'me.resource.' + chatPrompt.to;
  }

  /** select based on user configs. once chosen, usually don not change. */
  protected async _getResourceConfig(
    chatPrompt: SimpleChatPrompt,
    ctx: Record<string, any>,
  ): Promise<ResourceConfig> {
    /** fix to chosen resource for the actor. */
    const _bindConfigKey = this._getActorBoundCtxKey(chatPrompt);
    let config = await ctx[_bindConfigKey];
    if (config) return config;

    // select from logon user config,
    const curActor = this.authService.currentActor();
    const me = await this.usersService.findOne(curActor.ownerId);
    const configs = await this._filterUserConfigs(me.resConfigs);
    config = await this._selectUserConfig(configs, chatPrompt, ctx);
    if (!config)
      throw new BadRequestException(
        'current user has no resource config for ' + chatPrompt.to,
      );

    /** fix to the chosen resource for the actor. */
    ctx[_bindConfigKey] = { ...config };
    return config;
  }

  protected async _filterUserConfigs(resConfigs: ResourceConfig[]) {
    // filter by protocol/quota
    const configs: ResourceConfig[] = [];
    for (const r of resConfigs) {
      if (r.type != this.protocol()) continue;
      // quota
      if (r.runtime != 'platform') {
        configs.push(r);
        continue;
      }

      const quota = await this.quotasService.$getQuota(
        r.runtime,
        r.type,
        r.name,
      );
      if (!(quota?.quota <= 0) || !(quota?.invalidAt?.getTime() < Date.now()))
        configs.push(r);
    }
    return configs;
  }

  /** select appropriate config from user */
  protected async _selectUserConfig(
    filteredConfigs: ResourceConfig[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    chatPrompt: SimpleChatPrompt,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ctx: Record<string, any>,
  ) {
    return filteredConfigs.find((c) => c.type == this.protocol());
  }

  /** if runtime local, just forward req to local. */
  protected _getResourceDriver(config: ResourceConfig): AbsResourceDriver {
    if (config.runtime === 'local') {
      // all local protocol goes to same driver
      // always forward all req to local runtime.
      return this.pluginProvider.getPlugin(
        LocalResourceDriver.prototype.pname(),
        PluginType.DRIVER,
      );
    } else {
      return this.pluginProvider.getPlugin(
        'resource:' + this.protocol(),
        PluginType.DRIVER,
      );
    }
  }
}
