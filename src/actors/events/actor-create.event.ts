import { Actor, Host } from '@prisma/client';
import { ChatDto } from '../chats/dto/chat-dto';
import { ActorStatus } from '../vo/actor-status.enum';
import { ActorBaseEvent } from './actor-base.event';

/** fired when a new actor created. fired only once for an actor */
export class ActorCreateEvent extends ActorBaseEvent {
  public static readonly eventName = 'actor.create';

  constructor(actor: Actor, host: Host, data?: ChatDto) {
    super(actor, host, ActorStatus.creating, data);
  }
}
