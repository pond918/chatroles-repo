import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Actor } from '@prisma/client';
import Ajv from 'ajv';
import { HostsService } from '../../hosts/hosts.service';
import { ChatEntryHandle } from '../../hosts/vo/chat-entry-handle';
import { ScopedStorageMan } from '../../infras/repos/scoped-storage.service';
import { toJSON } from '../../utils';
import { ActorsService } from '../actors.service';
import { PromptsService, QuickResponse } from '../prompts/prompts.service';
import { ActorStatus } from '../vo/actor-status.enum';
import { actorDefaultEntries } from './actor-default.entries';
import { ChatDto } from './dto/chat-dto';
import { PreChatEvent } from './events/pre-chat.event';

@Injectable()
export class ChatsService {
  protected readonly ajv = new Ajv();
  constructor(
    private readonly scopedStorageMan: ScopedStorageMan,
    private readonly hostsService: HostsService,
    private readonly actorsService: ActorsService,
    private readonly promptsService: PromptsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  ////////// actor variables space scoped context mgmt

  // beginContext(actor: Actor, taskName?: string) {
  //   // user actor cannot create task ctx
  //   if (actor.id === actor.parentId)
  //     throw new BadRequestException('cannot begin a task on root user.');

  //   // begin a new scope under current ctx
  //   actor.ctxId = this.scopedStorage.createScope(actor.ctxId, true, taskName);
  //   // set ctx into request ctx.
  //   this.clsService.set(AppConstant.clsKeyScopedCtxId, actor.ctxId);
  //   // update longrun ctx
  //   this.actorsService.updateCtxIds(actor.id, actor.ctxId);
  // }

  // endContext(actor: Actor, taskName?: string) {
  //   if (actor.id === actor.parentId)
  //     throw new BadRequestException('cannot begin a task on root user.');
  //   const ctxId = this.scopedStorage.endScope(actor.ctxId, taskName);
  //   if (ctxId === undefined)
  //     throw new BadRequestException('no task found named: ' + taskName);

  //   actor.ctxId = ctxId;
  //   // set ctx into request ctx.
  //   this.clsService.set(AppConstant.clsKeyScopedCtxId, actor.ctxId);
  //   // update longrun ctx
  //   this.actorsService.updateCtxIds(actor.id, actor.ctxId);
  // }

  /**
   * chat from entry
   * @param member may not ready.
   * @throws NotFoundException if non-empty entry not found on host.
   */
  async chatEntry(
    actor: Actor,
    contextual: boolean,
    reqDto?: ChatDto,
    entry = '',
  ): Promise<ChatDto> {
    const host =
      actor.hostId && (await this.hostsService.findOne(actor.hostId));
    if (!host) {
      if (entry)
        throw new NotFoundException(
          `No entry found from the actor ${actor.nick}, entry: ${entry}`,
        );
      return null; // null host respond null.
    }

    // predefined entry
    const entries = host.onEntries as unknown as ChatEntryHandle[];
    const entryCmd = [...entries, ...actorDefaultEntries].find(
      (ent) => ent.name == entry || !(entry || ent.name),
    );
    if (!entryCmd)
      return ChatDto.error(
        reqDto,
        404,
        `No entry found from the actor ${actor.nick}, entry: ${entry}`,
      );

    if (!entryCmd.handle) return null; // null handle returns null

    // TODO check input schema

    // entryCmd may override callers contextual
    const overrideContextual = typeof entryCmd.contextual !== 'undefined';
    await this.eventEmitter.emitAsync(
      PreChatEvent.eventName,
      new PreChatEvent(
        actor,
        overrideContextual ? entryCmd.contextual : contextual,
        entryCmd,
        reqDto,
      ),
    );

    try {
      // check status, if not ready, wait/return,
      const ctx = await this.promptsService.getContext(actor);
      if ((await this.actorsService.getStatus(ctx)) !== ActorStatus.ready) {
        // TODO observe/await ready,
        // return fake dto,
        return new ChatDto(
          `the actor(${actor.nick}) is not ready, task stopped.`,
          1,
        );
      }

      return this.chatEntry1(actor, reqDto, entryCmd);
    } finally {
      if (overrideContextual) {
        // recover caller contextual
        await this.promptsService.initContext(actor, contextual, reqDto);
      }
    }
  }

  protected async chatEntry1(
    actor: Actor,
    reqDto: ChatDto,
    entryCmd: ChatEntryHandle,
  ) {
    // send chat request to host.
    const resp = await this.promptsService.process(
      actor,
      entryCmd.handle,
      reqDto,
    );

    return this._response(resp, entryCmd);
  }

  protected _response(
    resp: QuickResponse<ChatDto>,
    entry: ChatEntryHandle,
    chainLast = false,
  ) {
    if (Array.isArray(resp)) {
      // NO AWAIT, quick response
      resp[0].then((v) => this._response(v, entry, true));
      return ChatDto.error(
        { ...resp[1] }, // clone fake dto
        -1,
        'request is still processing, response will be pushed to you later.',
      );
    }

    if (entry.schema && !resp.statusCode) {
      // final response schema validation
      let schema = entry.schema;
      if (typeof schema === 'string') schema = toJSON(schema); // FIXME supported schema version
      const validate = this.ajv.compile(schema);
      const valid = validate(resp.data);
      if (!valid)
        resp = ChatDto.error(resp, 400, JSON.stringify(validate.errors));
    }

    chainLast && resp.options.resolve && resp.options.resolve(resp);
    return resp;
  }
}
