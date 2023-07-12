import { Actor, Host } from '@prisma/client';
import { ChatDto } from '../chats/dto/chat-dto';
import { ActorStatus } from '../vo/actor-status.enum';

export abstract class ActorBaseEvent {
  constructor(
    public readonly actor: Actor,
    public readonly host: Host,
    /** status for current event, may null */
    public readonly status: ActorStatus | null,
    /** data related to the event */
    public readonly data?: ChatDto,
    public readonly context = {},
  ) {}
}
