import { Actor, Host } from '@prisma/client';
import { ChatDto } from '../chats/dto/chat-dto';
import { ActorStatus } from '../vo/actor-status.enum';
import { ActorBaseEvent } from './actor-base.event';

/** fired after creation. do initialization. fired at least once. */
export class ActorInitEvent extends ActorBaseEvent {
  public static readonly eventName = 'actor.init';

  constructor(actor: Actor, host: Host, data?: ChatDto) {
    super(actor, host, ActorStatus.initing, data);
  }
}
