import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Actor, MemoryNode, Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaTransactionScope } from '../infras/repos/tx/prisma-tx-scope';
import { UUID } from '../infras/repos/uuid';
import { CreateMemoryVersionDto } from '../memory-versions/dto/create-memory-version.dto';
import { CreateMemoryNodeDto } from './dto/create-memory-node.dto';

@Injectable()
export class MemoryService {
  constructor(
    protected readonly transactionScope: PrismaTransactionScope,
    protected readonly configService: ConfigService,
  ) {}

  async getNodeById(actor: Actor, id: string) {
    // filter deleted version
    return this.transactionScope.run(async (prisma) => {
      const list: any[] =
        await prisma.$queryRaw`SELECT n.id, n.actor_id, n.version_id, n.domain, n.parent_id, n.key, n.summary, n.content
      FROM memory_nodes n left join memory_versions v on n.version_id=v.id where n.id=${id}
      and v.deleted=false and n.deleted=false and n.actor_id=${actor.id} limit 1`;
      return this._mapNode(list.at(0));
    });
  }

  async getNodeByKey(
    actor: Actor,
    domain: string,
    keys: { key: string; versionId: string },
  ) {
    // filter deleted version
    return this.transactionScope.run(async (prisma) => {
      const list: any[] =
        await prisma.$queryRaw`SELECT n.id, n.actor_id, n.version_id, n.domain, n.parent_id, n.key, n.summary, n.content
      FROM memory_nodes n left join memory_versions v on n.version_id=v.id where v.deleted=false and n.deleted=false
      and n.key=${keys.key} and n.domain=${domain} and n.actor_id=${actor.id} and n.version_id=${keys.versionId} limit 1`;
      return this._mapNode(list.at(0));
    });
  }

  /**
   * list all nodes as chains
   */
  async listNodeChains(actor: Actor, domain: string, versionId: string) {
    return this.transactionScope.run(async (prisma) => {
      const version = versionId
        ? await prisma.memoryVersion.findUnique({
            where: { id: versionId },
          })
        : await this.getLastVersion(actor);
      if (version?.actorId != actor.id) return null;

      const nodes = await prisma.memoryNode.findMany({
        select: {
          id: true,
          key: true,
          parentId: true,
          versionId: true,
          domain: true,
          actorId: true,
          content: true,
          summary: true,
          createdAt: true,
          updatedAt: true,
        },
        where: { versionId: version.id, domain, actorId: actor.id },
        orderBy: { key: 'asc' },
      });
      const map = new Map(),
        parentIds = new Set();
      for (const n of nodes)
        map.set(n.id, n), n.parentId && parentIds.add(n.parentId);

      const chain = [];
      for (const n of nodes) {
        if (parentIds.has(n.id)) continue; // not leaf

        const chainForNode: { id: string; parentId: string }[] = [];
        let current = n;
        while (current != null) {
          chainForNode.unshift(current);
          current = map.get(current.parentId);
        }
        chain.push(chainForNode);
      }

      return chain;
    });
  }

  protected _mapNode(row: any): any {
    if (row) {
      row.actorId = row.actor_id;
      row.parentId = row.parent_id;
      row.versionId = row.version_id;
      delete row.actor_id;
      delete row.parent_id;
      delete row.version_id;
    }
    return row;
  }

  /**
   * @param nodes nodes with same parentId are cleared if not in nodes
   */
  async upsertNodes(actor: Actor, nodes: CreateMemoryNodeDto[]) {
    if (!nodes?.length) return;
    return this.transactionScope.run(async (prisma) => {
      const texts = [],
        nodesByParent = new Map<string, bigint[]>();
      const promisesUpsert: Promise<MemoryNode>[] = [];
      for (const n of nodes) {
        if (!n.key) throw new BadRequestException('node.key is required');
        if (!n.versionId)
          throw new BadRequestException('node.version is required');
        if (!n.content)
          throw new BadRequestException('node.content is required');
        if (!n.id) n.id = await UUID.gen();
        n.actorId = actor.id;
        n.parentId || (n.parentId = '');

        typeof n.content == 'string'
          ? texts.push(n.content)
          : texts.push(JSON.stringify(n.content));

        promisesUpsert.push(
          prisma.memoryNode
            .upsert({
              where: {
                actorId_versionId_domain_key: {
                  actorId: n.actorId,
                  domain: n.domain,
                  versionId: n.versionId,
                  key: n.key,
                },
              },
              update: n,
              create: n as any,
            })
            .then((n) => {
              let pks = nodesByParent.get(n.parentId);
              if (!pks) nodesByParent.set(n.parentId, (pks = []));
              pks.push(n.pk);
              return n;
            }),
        );
      }

      const promiseDb = Promise.all(promisesUpsert).then(() => {
        const promisesRemove = [];
        for (const entry of nodesByParent.entries()) {
          promisesRemove.push(
            prisma.memoryNode.deleteMany({
              where: {
                actorId: actor.id,
                parentId: entry[0],
                pk: { notIn: entry[1] },
              },
            }),
          );
        }
        return Promise.all(promisesRemove);
      });

      const promisesEmbed = this.embedTexts(texts).then(
        (vectors: number[][]) => {
          if (vectors?.length != nodes.length)
            throw new InternalServerErrorException(
              'failed to embedding nodes content',
            );
          const promisesEmbed = [];
          for (let idx = 0; idx < nodes.length; idx++) {
            const v = JSON.stringify(vectors[idx]);
            promisesEmbed.push(
              promisesUpsert[idx].then(
                (n) =>
                  prisma.$executeRaw`update memory_nodes set embedding=(${v}::vector) where pk=${n.pk} and deleted=false`,
              ),
            );
          }
          return Promise.all(promisesEmbed);
        },
      );

      await Promise.all([promiseDb, promisesEmbed]);
      return nodes;
    });
  }

  async removeNodes(actor: Actor, ids: any, subsOnly = false) {
    // delete all sub-nodes and  nodes
    return this.transactionScope.run(async (prisma) => {
      const promises = [];
      this.removeNodes0(promises, prisma, actor, ids, subsOnly);
      return Promise.all(promises);
    });
  }

  protected async removeNodes0(
    promises: Promise<any>[],
    prisma: any,
    actor: Actor,
    ids: any,
    subsOnly = false,
  ) {
    if (!ids?.length) return;
    // delete all sub-nodes and  nodes
    if (!subsOnly)
      promises.push(
        prisma.memoryNode.deleteMany({
          where: { id: { in: ids }, actorId: actor.id },
        }),
      );
    promises.push(
      prisma.memoryNode
        .findMany({
          select: { id: true },
          where: { parentId: { in: ids }, actorId: actor.id },
        })
        .then((subIds) => this.removeNodes0(promises, prisma, actor, subIds)),
    );
  }

  /**
   * @param parentIds root nodes if empty
   * @param versionId last version if empty
   * @param count default 5
   */
  async queryNodes(
    actor: Actor,
    domain = '',
    parentIds?: string[],
    versionId?: string,
    count = 5,
  ) {
    return this.transactionScope.run(async (prisma) => {
      versionId || (versionId = (await this.getLastVersion(actor))?.id);
      if (!versionId) return null;

      const where: any = {
        actorId: actor.id,
        domain,
        versionId: versionId,
        deleted: false,
      };
      if (parentIds?.length) where.parentId = { in: parentIds };
      else where.parentId = ''; // root node
      return prisma.memoryNode.findMany({
        where,
        take: count,
        orderBy: { key: 'asc' },
      });
    });
  }

  /**
   * semantic match from list of nodes
   * @versionId if empty, will query the latest version
   */
  async matchNodes(
    actor: Actor,
    domain: string,
    text: string,
    parentIds?: string[],
    versionId?: string,
    count = 5,
  ) {
    return this.transactionScope.run(async (prisma) => {
      versionId || (versionId = (await this.getLastVersion(actor))?.id);
      if (!versionId) return null;

      // embedding
      const textEmbed = JSON.stringify((await this.embedTexts([text]))[0]);
      let nodes;
      if (parentIds?.length)
        nodes =
          await prisma.$queryRaw`SELECT id, actor_id, version_id, domain, parent_id, key, summary, content
        FROM memory_nodes where actor_id=${actor.id} and domain=${domain}
        and deleted=false and version_id = ${versionId} and parent_id in (${Prisma.join(
            parentIds,
          )})
        ORDER BY embedding <-> ${textEmbed}::vector LIMIT ${count}`;
      else
        nodes =
          await prisma.$queryRaw`SELECT id, actor_id, version_id, domain, parent_id, key, summary, content
        FROM memory_nodes where actor_id=${actor.id} and domain=${domain}
        and deleted=false and version_id = ${versionId} and parent_id is null
        ORDER BY embedding <-> ${textEmbed}::vector LIMIT ${count}`;
      return nodes?.map((n) => this._mapNode(n));
    });
  }

  async getLastVersion(actor: Actor) {
    return this.transactionScope.run(async (prisma) =>
      prisma.memoryVersion.findFirst({
        where: { actorId: actor.id },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  /**
   * @param key if empty, get last version
   */
  async getVersion(actor: Actor, key?: string) {
    if (!key) return this.getLastVersion(actor);
    return this.transactionScope.run(async (prisma) =>
      prisma.memoryVersion.findFirst({
        where: { actorId: actor.id, key },
      }),
    );
  }

  /**
   * get version, with nodes count.
   *
   * @returns : { version, nodes: number } | null
   */
  async getVersionCounted(actor: Actor, key?: string) {
    const ver = await this.getVersion(actor, key);
    if (!ver) return;
    return this.transactionScope.run(async (prisma) => ({
      nodes: await prisma.memoryNode.count({
        where: { versionId: ver.id, actorId: actor.id },
      }),
      version: ver,
    }));
  }

  async removeVersion(actor: Actor, key: string) {
    return this.transactionScope.run(async (prisma) => {
      await this.resetVersion(actor, key);
      throw new Error('Method not implemented.');
    });
  }

  /** remove all nodes */
  async resetVersion(actor: Actor, key: string) {
    if (!key)
      throw new BadRequestException('version key is required to reset.');
    // guard published version
    return this.transactionScope.run(
      async (prisma) =>
        prisma.$executeRaw`delete from memory_nodes n left join memory_versions v on n.version_id = v.id
          where v.key=${key} and v.actor_id=${actor.id} and v.published=false`,
    );
  }

  async publishVersion(actor: Actor, key: string) {
    throw new Error('Method not implemented.');
  }

  async createVersion(actor: Actor, data: CreateMemoryVersionDto) {
    if (!data.key) throw new BadRequestException('version.key is required');
    data.actorId = actor.id;
    return this.transactionScope.run(async (prisma) =>
      prisma.memoryVersion.create({
        data: { ...data, id: await UUID.gen() },
      }),
    );
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    const resp = await axios.post(
      `${this.configService.getOrThrow('API_CR_VDB')}/run/predict_2`,
      { data: [texts] },
      {
        headers: {
          Authorization: `Bearer ${this.configService.getOrThrow(
            'API_CR_VDB_TOKEN',
          )}`,
          'Content-type': 'application/json',
        },
      },
    );
    const vectorArray = resp.data.data[0];
    return vectorArray;
  }

  /**
   * @returns stats: { domains: 3, versions: 2, nodes: 5 }
   */
  async stats(actor: Actor) {
    return { domains: 3, versions: 2, nodes: 5 };
  }
}
