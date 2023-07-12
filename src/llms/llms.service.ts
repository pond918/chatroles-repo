import { Injectable } from '@nestjs/common';
import { LLMBots } from '@pond918/llm-bots';

/** event names: sse.event.${userId}, `sse.response.${actor.ownerId}.${eventId}` */
@Injectable()
export class LLMsService {
  protected bots: LLMBots;

  constructor() {
    this.bots = new LLMBots(null, true);
  }

  bot(model: string, ctx: Record<string, any>) {
    const bot = this.bots.instance(model);

    // use actor's context
    bot._userStorage = {
      set: async (prop: string, v: unknown): Promise<void> => {
        ctx[prop] = v;
      },
      get: async <T>(prop: string): Promise<T> => {
        return ctx[prop];
      },
    };

    return bot;
  }

  list() {
    return Object.keys(this.bots.list());
  }
}
