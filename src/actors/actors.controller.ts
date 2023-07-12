import { MapInterceptor } from '@automapper/nestjs';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtGuard } from '../infras/auth/jwt.guard';
import { ActorsService } from './actors.service';
import { ActorDto } from './dto/actor.dto';
import { CreateActorDto } from './dto/create-actor.dto';
import { UpdateActorDto } from './dto/update-actor.dto';
import { Actor } from './entities/actor.entity';
import { AppConstant } from '../app.constants';

@ApiTags('chat-actors')
@Controller('actors')
@UseGuards(JwtGuard)
@ApiBearerAuth('defaultBearerAuth')
export class ActorsController {
  constructor(private readonly actorsService: ActorsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new actor from a published role, under a parent actor.',
    description:
      "When an actor is created, it's parent & root user will be informed. Constraints: this.parentId != creator.parentId. ",
  })
  @UseInterceptors(MapInterceptor(Actor, ActorDto))
  @ApiAcceptedResponse({ type: ActorDto })
  @ApiConflictResponse({ description: 'conflict nick under same parent.' })
  create(@Body() createActorDto: CreateActorDto) {
    // FIXME create with ChatDto as req.
    // if created by an actor, createdBy is inherited.
    return this.actorsService.$create(createActorDto);
  }

  @ApiOperation({
    description: `e.g. \`${AppConstant.systemUsername}\``,
  })
  @Get(':id')
  @UseInterceptors(MapInterceptor(Actor, ActorDto))
  findOne(@Param('id') id: string) {
    return this.actorsService.findOne(id);
  }

  @ApiOperation({
    parameters: [
      {
        name: 'id',
        in: 'path',
        example: 'ChatRoles-system-user',
      },
    ],
  })
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateActorDto: UpdateActorDto) {
    return this.actorsService.update(id, updateActorDto);
  }

  @ApiOperation({
    summary: 'only the owner can delete the role.',
  })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.actorsService.$remove(id);
  }
}
