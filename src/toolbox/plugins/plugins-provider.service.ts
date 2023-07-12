import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PluginType } from './plugins-loader.module';

@Injectable()
export class PluginProvider {
  constructor(private readonly moduleRef: ModuleRef) {}

  getPlugin<T>(protocol: string, type: PluginType): T {
    const name = `_-${PluginType[type]}-${protocol}`;
    const plugin = this.moduleRef.get(name);
    if (!plugin) throw new NotFoundException('no plugin found:' + protocol);
    return plugin;
  }
}
