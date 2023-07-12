import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Actor } from '@prisma/client';
import { ChatDto } from '../../../actors/chats/dto/chat-dto';
import { SimpleChatPrompt } from '../../../actors/prompts/prompts.service';
import { UUID } from '../../../infras/repos/uuid';
import { CreateMemoryNodeDto } from '../../../memory-nodes/dto/create-memory-node.dto';
import { MemoryService } from '../../../memory-nodes/memory.service';
import { CreateMemoryVersionDto } from '../../../memory-versions/dto/create-memory-version.dto';
import { AbsToolPlugin } from '../abstract-tool';

/** versioned tree-node memory isolated by actor. */
@Injectable()
export class MemoryTool extends AbsToolPlugin implements OnModuleInit {
  /** memory:(versions|nodes)#method[#domain] */
  protocol() {
    return 'memory';
  }
  private memoryService: any; // Jest hack: jest fails because of `prisma.$queryRaw` in MemoryService

  constructor(private readonly moduleRef: ModuleRef) {
    super();
  }

  async onModuleInit() {
    this.memoryService = await this.moduleRef.get(MemoryService, {
      strict: false,
    });
  }

  async _invoke(
    chatDto: ChatDto,
    chatPrompt: SimpleChatPrompt,
    ctx: Record<string, any>,
    actor: Actor,
  ) {
    const { model, method } = this._parseTo(chatPrompt.to);
    const domain = chatDto.options.domain;

    const [result, code, msg] = await this.dispatch(
      actor,
      domain,
      model,
      method,
      chatDto,
      chatPrompt,
    );
    if (code) return ChatDto.error(chatDto, code, msg, chatPrompt);
    if (Array.isArray(result)) for (const n of result) delete n?.pk;
    else delete result?.pk;
    chatDto.data = result;
    return chatDto;
  }

  /**
   * - versions#query
   * - versions#get
   * - versions#last
   * - versions#save
   * - versions#merge
   * - versions#remove
   *
   * - nodes#get
   * - nodes#query
   * - nodes#save
   * - nodes#remove
   */
  async dispatch(
    actor: Actor,
    domain: string,
    model: string,
    method: string,
    chatDto: ChatDto,
    chatPrompt: SimpleChatPrompt,
  ) {
    if (!method) return [null, 400, 'method is required'];
    domain || (domain = '');

    try {
      let data: any;
      if (model == 'nodes') {
        switch (method) {
          case 'save':
            data = this._getRequestData(chatDto, chatPrompt, true);
            if (!data) return [null, 400, 'data is required'];
            const nodes = await this._toNodes(true, data, actor, domain);
            return [await this.memoryService.upsertNodes(actor, nodes)];
          case 'remove':
            data = this._getRequestData(chatDto, chatPrompt, true);
            if (!data) return [null, 400, 'node ids is required'];
            return [await this.memoryService.removeNodes(actor, data)];
          case 'remove-subs':
            data = this._getRequestData(chatDto, chatPrompt, true);
            if (!data) return [null, 400, 'node ids is required'];
            return [await this.memoryService.removeNodes(actor, data, true)];
          case 'load':
            data = this._getRequestData(chatDto, chatPrompt, false);
            if (!data) return [null, 400, 'id is required'];
            return [await this.memoryService.getNodeById(actor, data)];
          case 'get':
            data = this._getRequestData(chatDto, chatPrompt, true);
            if (!data) return [null, 400, '{key, versionId} is required'];
            return [await this.memoryService.getNodeByKey(actor, domain, data)];
          case 'chains':
            data = this._getRequestData(chatDto, chatPrompt, false);
            if (!data) return [null, 400, 'version id is required'];
            return [
              await this.memoryService.listNodeChains(actor, domain, data),
            ];
          case 'match':
            const text = this._getRequestData(chatDto, chatPrompt, false);
            data = this._getRequestData(chatDto, chatPrompt, true);
            return [
              await this.memoryService.matchNodes(
                actor,
                data?.domain,
                text,
                data?.parentIds,
                data?.versionId,
                data?.count || 1,
              ),
            ];
          case 'query':
            data = this._getRequestData(chatDto, chatPrompt, true);
            // req.data{parentIds?, versionId?, count=1}
            return [
              await this.memoryService.queryNodes(
                actor,
                domain,
                data.parentIds,
                data.versionId,
                data.count || 1,
              ),
            ];
        }
      } else if (model == 'versions') {
        switch (method) {
          case 'save':
            data = this._getRequestData(chatDto, chatPrompt, true);
            if (!data?.key) {
              data = this._getRequestData(chatDto, chatPrompt, false);
              if (!data) return [null, 400, 'version key is required'];
              data = { key: data };
            }
            const ver = this._toVersion(actor, data);
            return [await this.memoryService.createVersion(actor, ver)];
          case 'publish':
            data = this._getRequestData(chatDto, chatPrompt, false);
            if (!data) return [null, 400, 'version id is required'];
            return [await this.memoryService.publishVersion(actor, data)];
          case 'reset':
            data = this._getRequestData(chatDto, chatPrompt, false);
            if (!data) return [null, 400, 'version id is required'];
            return [
              await this.memoryService.resetVersion(actor, data.toString()),
            ];
          case 'remove':
            data = this._getRequestData(chatDto, chatPrompt, false);
            if (!data) return [null, 400, 'version key is required'];
            return [
              await this.memoryService.removeVersion(actor, data.toString()),
            ];
          case 'get':
            data = this._getRequestData(chatDto, chatPrompt, false);
            return [
              await this.memoryService.getVersion(actor, data?.toString()),
            ];
          case 'count':
            data = this._getRequestData(chatDto, chatPrompt, false);
            return [
              await this.memoryService.getVersionCounted(
                actor,
                data?.toString(),
              ),
            ];
          case 'query':
          // FIXME
        }
      } else if (model == 'stats') {
        return [await this.memoryService.stats(actor)];
      }
      return [null, 400, `invalid model: ${model} or method: ${method}`];
    } catch (err) {
      return [null, err.status || 500, err.message];
    }
  }

  protected _toVersion(actor: Actor, data: any) {
    const v: CreateMemoryVersionDto = {
      key: data.key,
      actorId: actor.id,
      content: data,
      language: data.language,
    };
    return v;
  }

  /** node { id, actorId, versionId!, domain?, parentId?, key!, summary, content! } */
  protected async _toNodes(
    create: boolean,
    data: any,
    actor: Actor,
    domain: string,
  ) {
    if (!Array.isArray(data)) data = [data];
    const nodes: CreateMemoryNodeDto[] = [];
    for (const content of data) {
      if (create == !!content.id)
        throw new BadRequestException('invalid id for create.');
      const id = create ? await UUID.gen() : content.id;
      nodes.push({
        id,
        actorId: actor.id,
        key: content.key,
        versionId: content.versionId,
        domain,
        parentId: content.parentId,
        content: content.content,
        summary: content.summary,
      });
    }
    return nodes;
  }

  protected _parseTo(to: string) {
    to = to.substring(7);
    const [model, method] = to.split('#');
    return { model, method };
  }
}
