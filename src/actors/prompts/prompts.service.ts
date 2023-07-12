import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Actor } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { ActorsService } from '../../actors/actors.service';
import { ChatPrompt, ResponseRule } from '../../hosts/vo/chat-prompt';
import { ScopedStorageMan } from '../../infras/repos/scoped-storage.service';
import { ToolsService } from '../../toolbox/tools.service';
import { AbsToolPlugin } from '../../toolbox/plugins/abstract-tool';
import { ChatDto } from '../chats/dto/chat-dto';
import { wrapScopedStorageObject } from './scoped-storage-object';

/**
 * quick fake response in the middle of processing, post-processing is in promise.then
 */
export type QuickResponse<T> = T | [Promise<QuickResponse<T>>, T];
export type QuickResponse1<R, T> = T | [Promise<QuickResponse1<R, T>>, R];
type ThenActionDto = { idx: number; resp: QuickResponse<ChatDto> };

/**
 * service to process prompt.
 * - scoped variables space
 * - el in prompt: vars el, sendTo el.
 * - sendTo, protocol:target
 */
@Injectable()
export class PromptsService {
  constructor(
    private readonly toolsService: ToolsService,
    private readonly scopedStorage: ScopedStorageMan,
    private readonly actorsService: ActorsService,
    private readonly clsService: ClsService,
  ) {}

  /**
   * chat to tools: members/ctx/facilities(protocol based), and then process response
   * @param actor request from this actor
   * @param chatPrompt chat prompt
   * @param req input data for chat
   * @param rootCtx w/r from ctx root, for actor creation.
   * @returns false if exceeds maxQAs
   */
  async process(
    actor: Actor,
    chatPrompt: ChatPrompt,
    req: ChatDto,
    rootCtx = false,
  ) {
    const taskCtx = await this.getContext(actor, req, rootCtx);
    // preprocess chatPrompt
    const chatPrompt1 = await this.preprocess(req, chatPrompt);
    const to: AbsToolPlugin = this.toolsService.get(chatPrompt.to);
    // invoke tool, actual execution may be async and respond through user log.
    const resp = to ? await to.invoke(req, chatPrompt1, taskCtx, actor) : req;

    // TODO minus 1, then check > 0
    // if (resp.options.maxQAs < 0) {
    return this.handleResponseRules(
      actor,
      chatPrompt1,
      req,
      { resp, idx: 0 },
      taskCtx,
    );
  }

  /** convert to SimpleChatPrompt */
  protected async preprocess(req: ChatDto, chatPrompt: ChatPrompt) {
    let promptString,
      isJson = false;
    if (chatPrompt.prompt) {
      if (typeof chatPrompt.prompt !== 'string') {
        promptString = JSON.stringify(chatPrompt.prompt);
        isJson = true;
        promptString = promptString
          .replace(/"<\?/g, '<?')
          .replace(/\?>"/g, '?>')
          .replace(/"<</g, "'<<")
          .replace(/>>"/g, ">>'");
      } else {
        promptString = chatPrompt.prompt?.trim();
      }
    } else promptString = chatPrompt.prompt;
    const ret = { ...chatPrompt, promptString, isJson };
    delete ret.prompt;
    return ret;
  }

  async quickResponse(
    resp: QuickResponse<ChatDto>,
    fn: (resp: ChatDto) => Promise<QuickResponse<ChatDto>>,
  ) {
    if (Array.isArray(resp)) {
      resp[0] = resp[0].then(fn); // promise chain
      return resp;
    }
    return fn(resp);
  }

  async handleResponseRules(
    caller: Actor,
    chatPrompt: SimpleChatPrompt,
    req: ChatDto,
    dto: QuickResponse1<ChatDto, ThenActionDto>,
    taskCtx: Record<string, any>,
  ): Promise<QuickResponse<ChatDto>> {
    if (Array.isArray(dto)) {
      return [
        dto[0].then((v) =>
          this.handleResponseRules(caller, chatPrompt, req, v, taskCtx),
        ),
        dto[1],
      ];
    }
    if (Array.isArray(dto.resp)) {
      const idx = dto.idx;
      dto.resp[0] = dto.resp[0].then((v) =>
        this.handleResponseRules(
          caller,
          chatPrompt,
          req,
          { idx, resp: v },
          taskCtx,
        ),
      );
      return dto.resp;
    }
    // propagate request options
    req?.options &&
      (dto.resp.options = { ...req.options, ...dto.resp.options });

    if (!chatPrompt.responses?.length) return dto.resp;
    for (; dto.idx < chatPrompt.responses.length; dto.idx++) {
      dto = await this.handleResponseRule(
        dto.idx,
        dto.resp,
        caller,
        chatPrompt,
        taskCtx,
      );
      if (Array.isArray(dto)) {
        return [
          dto[0].then((v) =>
            this.handleResponseRules(caller, chatPrompt, req, v, taskCtx),
          ),
          dto[1],
        ];
      }
      const idx1 = dto.idx;
      if (Array.isArray(dto.resp)) {
        dto.resp[0] = dto.resp[0].then((v) =>
          this.handleResponseRules(
            caller,
            chatPrompt,
            req,
            { idx: idx1, resp: v },
            taskCtx,
          ),
        );
        return dto.resp;
      }
    }
    return dto.resp;
  }

  protected async handleResponseRule(
    idx: number,
    req: ChatDto,
    caller: Actor,
    chatPrompt: SimpleChatPrompt,
    taskCtx: Record<string, any>,
  ): Promise<QuickResponse1<ChatDto, ThenActionDto>> {
    if (idx >= chatPrompt.responses.length) return { idx, resp: req };
    const rule = this._toRule(chatPrompt.responses[idx]);
    // whether rule matches
    const matches = await this.doRuleWhenMatches(rule, req, caller, taskCtx);
    return this.doRuleThenAction(matches, idx, req, caller, rule);
  }

  /**
   * @param req the object will not be changed
   */
  protected async doRuleWhenMatches(
    rule: ResponseRule,
    req: ChatDto,
    caller: Actor,
    taskCtx: Record<string, any>,
  ) {
    let matches: boolean | QuickResponse<ChatDto>;
    if (typeof rule.when === 'undefined') matches = !req.statusCode;
    if (!matches && rule.when) {
      // when clause do not change original req.
      const reqClone = JSON.parse(JSON.stringify(req));
      const contextual = !!(await taskCtx.id);
      // when clause always contextless
      if (contextual) taskCtx = await this.initContext(caller, false, reqClone); // FIXME root？
      try {
        const chatPrompt = this._toChatPrompt(rule.when, 'eval');
        matches = await this.process(caller, chatPrompt, reqClone);
      } finally {
        // restore
        if (contextual)
          taskCtx = await this.initContext(caller, true, reqClone);
      }
    }
    return matches;
  }

  protected _semanticMatch(match: ChatDto, req: ChatDto): boolean {
    if (match.statusCode) {
      // do not treat as error. just no match
      // req.statusCode || (req.statusCode = match.statusCode);
      req.message || (req.message = match.message);
      return false;
    }

    if (!match.text) return false;

    return (
      (/\b(ok|yes|true)\b/i.test(match.text) && !match.statusCode) ||
      (/\bErrorHandle\b/i.test(match.text) && !!match.statusCode)
    );
  }

  protected async doRuleThenAction(
    match: boolean | QuickResponse<ChatDto>,
    idx: number,
    req: ChatDto,
    caller: Actor,
    rule: ResponseRule,
  ): Promise<QuickResponse1<ChatDto, ThenActionDto>> {
    if (Array.isArray(match)) {
      return [
        match[0].then((m) => this.doRuleThenAction(m, idx, req, caller, rule)),
        match[1],
      ];
    }
    if (typeof match !== 'boolean') match = this._semanticMatch(match, req);

    let resp: QuickResponse<ChatDto>;
    if (match) {
      resp = rule.then
        ? await this.process(
            caller,
            this._toChatPrompt(rule.then),
            req,
            // isRoot, FIXME
          )
        : req;

      // flow control
      const { break: breaks, loop } = rule;
      if (loop) idx -= 1;
      else if (breaks) {
        idx = Number.MAX_SAFE_INTEGER;
        if (typeof breaks !== 'boolean') {
          // breaks to loop tag.
          // FIXME bubble up to ancestor loop tag;
          throw new Error('Method not implemented.');
        }
      }
    } else if (rule.else) {
      let elsePrompt = this._toChatPrompt(rule.else);
      if (!elsePrompt.to && !elsePrompt.responses?.length)
        elsePrompt = this._toChatPrompt(rule.then);

      resp = await this.process(
        caller,
        elsePrompt,
        req,
        // isRoot, FIXME
      );
      // else will not activate flow control.
    } else resp = req;

    return { resp, idx };
  }

  /** update maxQAs in ctx */
  async updateMaxQAs(maxQAs, ctx: Record<string, any>) {
    const ctxReqDto = await ctx.req;
    ctxReqDto.options || (ctxReqDto.options = {});
    ctxReqDto.options.maxQAs = maxQAs;
  }

  private _toRule(rule: string | ResponseRule): ResponseRule {
    if (typeof rule === 'string') rule = new ResponseRule(rule);
    return rule;
  }

  private _toChatPrompt(
    chatPrompt: string | ChatPrompt,
    to = 'llm',
  ): ChatPrompt {
    if (typeof chatPrompt === 'string') return new ChatPrompt(chatPrompt, to);
    return chatPrompt;
  }

  private static readonly OVERRIDDEN_STORAGE = '__OVERRIDDEN_STORAGe';
  /**
   * init ctx into cls req.
   * - contextless: get(check non long, if not switch), if none, create req
   * - get req(check long, if not switch), if none get current, if none throw | create & save to actor.
   *
   * @param create whether create ctx if none. since ctx is propagated through sub-actors,
   *  so only root actor ActorCreateEvent need to create new ctx.
   */
  async initContext(
    actor: Actor,
    longrun: boolean,
    reqDto?: ChatDto,
    rootCtx = false,
    create?: boolean,
  ) {
    let storage = await this.scopedStorage.getScope(); // get exiting ctx
    if (storage && longrun != !!(await storage?.getId())) {
      // current ctx overridden,
      if (longrun) {
        // short -> long: store current short into req, get parent
        this.clsService.set(PromptsService.OVERRIDDEN_STORAGE, storage.data);
        storage = await this.scopedStorage.getScope(
          storage.data.parentId,
          true,
        );
      } else {
        // long -> short: put back/create short
        const data = this.clsService.get(PromptsService.OVERRIDDEN_STORAGE);
        this.clsService.set(PromptsService.OVERRIDDEN_STORAGE, null);
        if (data) storage = await this.scopedStorage.getScope(null, true, data);
        else storage = await this.scopedStorage.createScope(actor.ctxId, false);
      }
    }

    if (!storage) {
      if (longrun) {
        storage =
          actor.ctxId && (await this.scopedStorage.getScope(actor.ctxId, true));
        if (!(storage || create))
          throw new InternalServerErrorException('no longrun ctx exists');
      }
      if (!storage) {
        storage = await this.scopedStorage.createScope(actor.ctxId, longrun);
        if (longrun)
          await this.actorsService.updateCtxIds(actor, await storage.getId());
      }
    }

    return this.getContext(actor, reqDto, rootCtx);
  }

  /**
   * get task ctx from cls, throw if none.
   *
   * @param reqDto: is wrapped as builtin property `request`.
   * @param respDto: is wrapped as builtin property `response`.
   */
  async getContext(actor: Actor, reqDto?: ChatDto, rootCtx = false) {
    const storage = await this.scopedStorage.getScope();
    if (!storage)
      throw new NotFoundException('no task ctx found on request scope.');
    const namespace = actor.id;
    actor = { ...actor };
    delete actor.authToken;
    actor['status'] = await storage.get('me.status', namespace, rootCtx);
    return wrapScopedStorageObject(
      storage,
      {
        me: actor,
        req: reqDto || new ChatDto(), // always non-null
      },
      namespace,
      rootCtx,
    );
  }
}

/** prompt is only string */
export class SimpleChatPrompt {
  to?: string = 'llm';
  promptString: string;
  /** whether `promptString` is JSON object */
  isJson?: boolean;
  responses?: string | ResponseRule[];
}
