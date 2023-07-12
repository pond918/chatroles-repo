import { Module, forwardRef } from '@nestjs/common';
import { HostsModule } from '../hosts/hosts.module';
import { ToolsModule } from '../toolbox/tools.module';
import { RolesModule } from '../roles/roles.module';
import { ActorsController } from './actors.controller';
import { ActorsService } from './actors.service';
import { ChatsController } from './chats/chats.controller';
import { ChatsService } from './chats/chats.service';
import { ActorCreateListener } from './listeners/actor-create.listener';
import { ActorCreatedListener } from './listeners/actor-created.listener';
import { ActorInitListener } from './listeners/actor-init.listener';
import { AuthUpdateTokenListener } from './listeners/auth-update-token.listener';
import { PreChatListener } from './listeners/pre-chat.listener';
import { PromptsService } from './prompts/prompts.service';

@Module({
  controllers: [ActorsController, ChatsController],
  providers: [
    ActorsService,
    ChatsService,
    PromptsService,
    AuthUpdateTokenListener,
    ActorCreateListener,
    ActorCreatedListener,
    ActorInitListener,
    PreChatListener,
  ],
  imports: [RolesModule, HostsModule, forwardRef(() => ToolsModule)],
  exports: [ActorsService, ChatsService, PromptsService],
})
export class ActorsModule {}
