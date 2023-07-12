import { Logger, Provider } from '@nestjs/common';
import { glob } from 'glob';
import { PluginType } from './plugins-loader.module';

const logger = new Logger('plugins');

/**
 * @param paths plugin paths in order
 * @param pluginName parse plugin name
 */
export const loadPlugins = async (paths: string[], pluginType: PluginType) => {
  // Feel free to change path if your structure is different
  const pluginsRelativePathWithoutExt = paths
    .reduce((pres, val) => [...glob.sync(val), ...pres], [])
    .map((path) => path.replace('src/', './../../'))
    .map((path) => path.replace('.ts', ''));

  const pluginProviders: Provider<any>[] = [];
  const pluginNames = new Set();
  for (const modulePath of pluginsRelativePathWithoutExt) {
    const modules = await import(modulePath);
    // Might be different if you are using default export instead
    const plugin = modules[Object.keys(modules)[0]];
    const pname = plugin.prototype.pname();
    if (!pname) {
      logger.error(`Plugin must have a protocol, ignoring ${modulePath}`);
      continue;
    }
    if (pluginNames.has(pname)) {
      logger.error(
        `Duplicate plugins with name: "${pname}", ignoring ${modulePath}`,
      );
      continue;
    }

    pluginNames.add(pname);
    logger.warn(`Loading ${PluginType[pluginType]}: ${pname} - ${plugin.name}`);
    pluginProviders.push({
      provide: `_-${PluginType[pluginType]}-${pname}`,
      useClass: plugin,
    });
  }
  return pluginProviders;
};
