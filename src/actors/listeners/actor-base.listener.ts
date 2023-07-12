import { ChatsService } from '../chats/chats.service';
import { ActorBaseEvent } from '../../actors/events/actor-base.event';

/**
 * All actor events are handled async. results are feed back from event logs.
 * event logging & error handling.
 */
export abstract class ActorBaseListener {
  constructor(protected readonly chatsService: ChatsService) {}

  /** logging event & errors to actor. */
  async onHandleEvent(
    handler: (event: ActorBaseEvent, eventCtx: object) => Promise<void>,
    event: ActorBaseEvent,
    eventCtx: object,
  ) {
    const { actor, host } = event;
    if (!host) return; // no host, do nothing.

    try {
      return handler.call(this, event, eventCtx);
    } catch (error) {
      // FIXME this.chatsService.chatPrompt(actor, error, 'log:exception');
    }
  }
}
