import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Actor } from '@prisma/client';
import { Observable, fromEvent } from 'rxjs';
import { JQueryStyleEventEmitter } from 'rxjs/internal/observable/fromEvent';
import { ChatDto } from '../actors/chats/dto/chat-dto';
import { EventTopic } from './event-topics.enum';
import { ActorEvent, ActorEventPayload } from './vo/actor-event.vo';

/** event names: sse.event.${userId}, `sse.response.${actor.ownerId}.${eventId}` */
@Injectable()
export class SsesService implements OnModuleInit {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const heartbeatTimeout =
      parseInt(this.configService.get('SSE_HEARTBEAT')) || 10000;
    setInterval(async () => {
      this.heartbeat();
    }, heartbeatTimeout);
  }

  subscribe(userId: string): Observable<ActorEvent> {
    const eventName = `sse.event.${userId}`;
    logger.warn('sse subscription, userId: %s', userId);

    // allow only one listener
    this.unsubscribe(eventName);
    return fromEvent<ActorEvent>(
      this.eventEmitter as JQueryStyleEventEmitter<any, ActorEvent>,
      eventName,
    );
  }

  unsubscribe(eventName: string) {
    this.eventEmitter.removeAllListeners(eventName);
  }

  /**
   * @returns false means client not online now.
   */
  emit(data: ActorEventPayload, topic: EventTopic, actor: Actor) {
    data.actorId = actor.id;
    const event = new ActorEvent(data, topic);
    const eventName = `sse.event.${actor.ownerId}`;

    const res = this.eventEmitter.emit(eventName, event);
    if (!res) this.unsubscribe(eventName);

    return res && event;
  }

  /** on event response */
  async onResponse(eventId: string, actor: Actor): Promise<ChatDto[]> {
    return this.eventEmitter.waitFor(
      `sse.response.${actor.ownerId}.${eventId}`,
      parseInt(this.configService.get('LOCAL_LLM_RESPONSE_TIMEOUT')),
    );
  }

  /** client respond to an event. */
  respond(eventId: string, data: ChatDto, userId: string) {
    return this.eventEmitter.emit(`sse.response.${userId}.${eventId}`, data);
  }

  protected heartbeat() {
    this.eventEmitter.eventNames(true).forEach(async (e) => {
      if (typeof e !== 'string' || !e.startsWith('sse.event.')) return;

      // send heartbeat
      const res = this.eventEmitter.emit(e, { data: { ts: Date.now() } });
      if (!res) {
        // dead code?
        this.unsubscribe(e);
        logger.warn('sse unsubscribed %s', e);
      }
    });
  }
}

const logger = new Logger(SsesService.name);
