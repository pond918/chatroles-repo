import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ActorsService } from '../../actors/actors.service';
import { AuthUpdateTokenEvent } from '../../infras/auth/events/auth-update-token.event';

@Injectable()
export class AuthUpdateTokenListener {
  constructor(private readonly actorsService: ActorsService) {}

  @OnEvent(AuthUpdateTokenEvent.eventName, { async: false })
  async handleEvent(event: AuthUpdateTokenEvent) {
    const { actorId, authToken } = event;
    if (!authToken)
      throw new InternalServerErrorException('token should not be empty.');
    await this.actorsService.updateToken(actorId, authToken);
  }
}
