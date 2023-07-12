import { DynamicModule } from '@nestjs/common';
import { ActorsModule } from '../../actors/actors.module';
import { HostsModule } from '../../hosts/hosts.module';
import { LLMsModule } from '../../llms/llms.module';
import { MemoryModule } from '../../memory-nodes/memory.module';
import { RolesModule } from '../../roles/roles.module';
import { SsesModule } from '../../sses/sses.module';
import { UsersModule } from '../../users/users.module';
import { loadPlugins } from './plugins-loader';
import { PluginProvider } from './plugins-provider.service';
import { QuotasModule } from '../../quotas/quotas.module';

export enum PluginType {
  TOOL,
  DRIVER,
}

/** */
export class PluginsLoaderModule {
  static async forRootAsync(): Promise<DynamicModule> {
    const toolPluginProviders = await loadPlugins(
      [
        'src/toolbox/plugins/3rd/**/*.tool.ts',
        'src/toolbox/plugins/builtin/**/*.tool.ts',
      ],
      PluginType.TOOL,
    );

    const driverPluginProviders = await loadPlugins(
      ['src/toolbox/plugins/builtin/**/*.driver.ts'],
      PluginType.DRIVER,
    );

    return {
      module: PluginsLoaderModule,
      providers: [
        ...toolPluginProviders,
        ...driverPluginProviders,
        PluginProvider,
      ],
      // You can omit exports if providers are meant to be used
      // only in this module
      exports: [PluginProvider],
      imports: [
        ActorsModule,
        HostsModule,
        RolesModule,
        UsersModule,
        MemoryModule,
        SsesModule,
        LLMsModule,
        QuotasModule,
      ],
    };
  }
}
