import { Body, Controller, Param, Patch, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Actor } from '@prisma/client';
import { Allow, IsNotEmpty } from 'class-validator';
import { AppConstant } from '../../app.constants';
import { JwtGuard } from '../../infras/auth/jwt.guard';
import { EntityIdExists } from '../../infras/validators/entity-exists.validator';
import { ChatsService } from './chats.service';
import { ChatDto } from './dto/chat-dto';

class ActorParams {
  @ApiProperty({
    description: 'actor id.',
    example: AppConstant.systemUsername,
    required: true,
  })
  @IsNotEmpty()
  @EntityIdExists('actor')
  id: string;

  getActor(): Actor {
    return EntityIdExists.entity<Actor>(this, 'id');
  }
}

class ActorEntryParams extends ActorParams {
  @ApiProperty({
    description:
      'actor entry name. if entry empty, same as call "/api/actors/:id/chat"',
    required: false,
    default: '',
  })
  @Allow() // for whitelist
  entry: string;
}

@ApiTags('chat-APIs')
@UseGuards(JwtGuard)
@ApiBearerAuth('defaultBearerAuth')
@Controller('actors/:id/')
export class ChatsController {
  constructor(private readonly chatService: ChatsService) {}

  // @Patch('begin')
  // @ApiOperation({
  //   summary: 'Begin a new long run task. Task name is optional.',
  //   description:
  //     'A long run task involves multiples chats in the same task context. Nested task is allowed.',
  // })
  // beginContext(@Param() chatParams: ActorParams, @Query('name') taskName = '') {
  //   this.chatService.beginContext(chatParams.getActor(), taskName);
  // }

  // @Patch('end')
  // @ApiOperation({
  //   summary: 'End a long run task. End current task if task name is empty.',
  //   description:
  //     'Contextual information is cleared inside the task. All nested tasks are also ended.',
  // })
  // endContext(@Param() chatParams: ActorParams, @Query('name') taskName = '') {
  //   this.chatService.endContext(chatParams.getActor(), taskName);
  // }

  @Put('chat')
  @ApiOperation({
    summary: 'Chat to the actor without context change.',
    description: 'Actor forgets what just chatted.',
  })
  chatNoCtx(@Param() chatParams: ActorParams, @Body() data?: ChatDto) {
    return this.chatService.chatEntry(chatParams.getActor(), false, data, '');
  }

  @Patch('chat')
  @ApiOperation({
    summary: 'Chat to the actor with context change.',
    description: 'Actor remembers everything just chatted.',
  })
  chat(@Param() chatParams: ActorParams, @Body() data?: ChatDto) {
    return this.chatService.chatEntry(chatParams.getActor(), true, data, '');
  }

  @Put('chat/:entry')
  @ApiOperation({
    summary:
      'Chat to the actor from a role pre-defined entry without context change',
    description:
      'If the request/response are structured json, then the json schema is defined on an entry.',
  })
  chatEntryNCtx(@Param() actorEntry: ActorEntryParams, @Body() data?: ChatDto) {
    return this.chatService.chatEntry(
      actorEntry.getActor(),
      false,
      data,
      actorEntry.entry,
    );
  }

  @Patch('chat/:entry')
  @ApiOperation({
    summary: 'Chat to the actor from a role pre-defined entry.',
    description:
      'If the request/response are structured json, then the json schema is defined on an entry.',
  })
  chatEntry(@Param() actorEntry: ActorEntryParams, @Body() data?: ChatDto) {
    return this.chatService.chatEntry(
      actorEntry.getActor(),
      true,
      data,
      actorEntry.entry,
    );
  }
}
