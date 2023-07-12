import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { IPlugin } from './plugins/abstract-tool';
import { PluginType } from './plugins/plugins-loader.module';
import { PluginProvider } from './plugins/plugins-provider.service';

/** tool is what an actor can chat to, including:
 * - actor
 * - llm
 * - task ctx,
 * - flow controller
 * - user log
 * - restAPI
 * - db
 * - cli ...
 *
 * tools are protocol based.
 */
@Injectable()
export class ToolsService {
  constructor(private readonly pluginProvider: PluginProvider) {}

  /**
   * @param uri tool uri
   */
  get<T extends IPlugin>(uri: string): T {
    if (!uri) return null; // default to null.
    // parse protocol
    const proto = this._parseProtocol(uri);
    const plugin: T = this.pluginProvider.getPlugin(proto, PluginType.TOOL);
    if (!plugin)
      throw new InternalServerErrorException('Unsupported tool plugin: ' + uri);

    return plugin;
  }

  /**
   * @param uri 'proto[:addr]', one special case: "@member1#entry2"
   */
  protected _parseProtocol(uri: string): string {
    if (uri[0] == '@') return '@';
    const idx = uri.indexOf(':');
    if (idx < 0) {
      return uri;
    } else if (idx > 0) return uri.substring(0, idx);

    throw new BadRequestException('invalid entry.handle.to: ' + uri);
  }
}
