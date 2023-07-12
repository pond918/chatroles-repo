import { Module, forwardRef } from '@nestjs/common';
import { ActorsModule } from '../actors/actors.module';
import { LLMsModule } from '../llms/llms.module';
import { OAuthAccessTokenListener } from './listeners/oauth-access-token.listener';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, OAuthAccessTokenListener],
  imports: [forwardRef(() => ActorsModule), LLMsModule],
  exports: [UsersService],
})
export class UsersModule {}
