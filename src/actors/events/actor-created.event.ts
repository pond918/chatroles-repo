import { Actor, Host } from '@prisma/client';
import { ChatDto } from '../chats/dto/chat-dto';
import { ActorStatus } from '../vo/actor-status.enum';
import { ActorBaseEvent } from './actor-base.event';

/** fired actor initialization. to check whether the actor is ready. if not, `actor.init` is fired again. */
export class ActorCreatedEvent extends ActorBaseEvent {
  public static readonly eventName = 'actor.created';

  constructor(actor: Actor, host: Host, data?: ChatDto) {
    super(actor, host, ActorStatus.ready, data);
  }
}
