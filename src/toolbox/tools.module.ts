import { Module } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { PluginsLoaderModule } from './plugins/plugins-loader.module';

@Module({
  imports: [PluginsLoaderModule.forRootAsync()],
  providers: [ToolsService],
  exports: [ToolsService],
})
export class ToolsModule {}
