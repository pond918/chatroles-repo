import { Body, Controller, Param, Post, Sse, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { ChatDto } from '../actors/chats/dto/chat-dto';
import { AuthService } from '../infras/auth/auth.service';
import { JwtGuard } from '../infras/auth/jwt.guard';
import { SsesService } from './sses.service';
import { ActorEvent } from './vo/actor-event.vo';

/**  */
@ApiTags('server-sent events')
@UseGuards(JwtGuard)
@ApiBearerAuth('defaultBearerAuth')
@Controller('events')
export class SsesController {
  constructor(
    private readonly authService: AuthService,
    private readonly eventsService: SsesService,
  ) {}

  /** sses subscription from owner user. */
  @ApiOperation({
    summary:
      'endpoint to receive server-sent events(sse). topics: `log`: actor log from server; `llm`: local llm request events.',
    description:
      '\
    const evtSource = new EventSource("//repo.roles.chat/api/events/subscribe", {\n\
      withCredentials: true,\n\
      headers: { Authorization: "Bearer " + authToken },\n\
    });\n\
    \n\
    evtSource.addEventListener("llm", (event) => {\n\
      const { actorId, payload } = JSON.parse(event.data);\n\
      console.log("llm name:", payload.options.name) \n\
      // handle event, then respond to server:\n\
      // $.post(`//repo.roles.chat/api/events/respond/${event.lastEventId}`, { statusCode:0, text: "xxx" })\n\
    });\n\
    evtSource.addEventListener("log", (event) => {\n\
      const { actorId, payload } = JSON.parse(event.data);\n\
    });\n\
    ',
  })
  @Sse('subscribe')
  subscribe(): Observable<ActorEvent> {
    const me = this.authService.currentActor();
    return this.eventsService.subscribe(me.ownerId);
  }

  @ApiOperation({
    summary: 'respond to a server sent event if necessary.',
    description: 'body.statusCode != 0 means error response. ',
  })
  @Post('respond/:eventId')
  respond(@Param('eventId') eventId: string, @Body() data: ChatDto) {
    const me = this.authService.currentActor();
    data.options || (data.options = {});
    return this.eventsService.respond(eventId, data, me.ownerId);
  }
}
