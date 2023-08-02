import { PrismaClient } from '@prisma/client';
import { ChatDto } from '../src/actors/chats/dto/chat-dto';
import { AppConstant } from '../src/app.constants';
import { ScriptPromptService } from '../src/toolbox/plugins/builtin/script.tool';

export enum KBKConstants {
  kbKeeperRoleId = 'knowledge-base-keeper',
}

/**
 * knowledge-base-keeper, to answer questions from a trees-nodes kb.
 * when given a source kb, and description of requirement to query/create/update target kb,
 * execution following the steps:
 * 1. drill down src, based on requirement, and load to context,
 * 2. from ctx, break requirement into list, recursively break?
 * 3. iterate list, drill down target, load to context,
 * 4. break down to action items, recursive?
 * 5. iterate items, load src/target context,
 * 6. create/update target content,
 */
export const seedKnowledgeBseKeeper = (prisma: PrismaClient) => {
  createKBKeeper(prisma);
};

const createKBKeeper = async (prisma: PrismaClient) => {
  const kbKeeperRoleDef = {
    id: KBKConstants.kbKeeperRoleId,
    nick: 'KBKeeper',
    goal: 'to maintain the knowledge-base, query/creating/updating/importing/exporting.\
 the KB may be documents to be chunked, or structured node trees.\n\
 the purpose of KB is to break big content into small chunks, to query only relevant context for answer.',
    skills: [
      'generate/refine content of the knowledge-base based on requirements',
      'semantic query knowledge-base',
      'import/export content of the knowledge-base',
    ],
    professionals: ['knowledge-base maintainer'],
    createdBy: AppConstant.systemUsername,
    published: true,
    entries: [
      {
        name: 'import',
        description: 'import documents by chunks, or structured trees of nodes',
      },
      {
        name: 'export',
        description: 'export content, structured, or documents.',
      },
      {
        name: 'remove',
        description: 'remove nodes by ids',
      },
      {
        name: 'query',
        description: '[drill down] query the KB nodes.',
      },
      {
        name: 'ask',
        description: '[drill down] query the KB for answer.',
      },
      {
        name: 'publish',
        description: 'publish to lock content of the version.',
      },
      {
        name: 'upgrade',
        description: 'upgrade a draft version for modification.',
      },
    ],
  };

  const kbkHostId = KBKConstants.kbKeeperRoleId + '-host';
  const kbkHostDef = {
    id: kbkHostId,
    roleId: KBKConstants.kbKeeperRoleId,
    members: [
      {
        name: 'TR',
        earlyCreate: false,
        hostId: AppConstant.translatorRoleId + '-host',
        roleId: AppConstant.translatorRoleId,
      },
    ],
    onEntries: [
      {
        name: 'intro',
        contextual: false,
        description: 'kb versions/nodes statistics.',
        handle: { to: 'memory:stats' },
      },
      {
        name: 'query',
        contextual: false,
        description:
          'criteria query {parentIds?, versionId?, count || 1}, reply nodes.',
        handle: { to: 'memory:nodes#query' },
      },
      {
        name: 'search',
        contextual: false,
        description: 'semantic search, reply nodes.',
        handle: { to: 'var:req.data,answer', prompt: '<?true?>' },
      },
      {
        name: 'ask',
        contextual: false,
        description:
          'drill down semantic query the KB. req.text as the question,\n\
req.data{parentIds?, versionId?, count=1, sbs=false}, sbs means step by step analyze to the question.\n\
resp.data === true means resp.text is the answer.',
        handle: { to: 'script', prompt: drillDownQueryKBNodes.toString() },
      },
      {
        name: 'import',
        description: 'import req.data as structured nodes; or chunk req.text.',
        handle: { to: 'script', prompt: importKBNodes.toString() },
      },
      {
        name: 'export', // TODO
        description: 'export content, structured, or documents.',
      },
      {
        name: 'get',
        description:
          'get a node by key, or latest if key empty, chatDto.data: {key, versionId}',
        handle: { to: 'memory:nodes#get' },
      },
      {
        name: 'chains',
        description: 'list the whole node tree by chains from versionId',
        handle: { to: 'memory:nodes#chains' },
      },
      {
        name: 'remove',
        description: 'remove nodes and sub-nodes by ids',
        handle: { to: 'memory:nodes#remove' },
      },
      {
        name: 'remove-subs',
        description: 'remove only sub-nodes by ids',
        handle: { to: 'memory:nodes#remove-subs' },
      },
      {
        name: 'version',
        description:
          'get the version by key, key empty will get latest version.',
        handle: { to: 'memory:versions#get' },
      },
      {
        name: 'version-count',
        description: 'get the version by key and nodes count in the version.',
        handle: { to: 'memory:versions#count' },
      },
      {
        name: 'version-reset',
        description: 'clear all nodes of the draft version by key.',
        handle: { to: 'memory:versions#reset' },
      },
      {
        name: 'publish',
        description: 'publish to lock content of the version.',
      },
      {
        name: 'upgrade',
        description: 'upgrade a draft version for modification.',
        handle: { to: 'memory:versions#save' },
      },
    ],
    createdBy: AppConstant.systemUsername,
    published: true,
    releasedNo: '0.0.1',
  };

  const kbk = await prisma.role.upsert({
    where: { id: KBKConstants.kbKeeperRoleId },
    create: kbKeeperRoleDef,
    update: kbKeeperRoleDef,
  });
  const kbkHost = await prisma.host.upsert({
    where: { id: kbkHostId },
    create: kbkHostDef,
    update: kbkHostDef,
  });

  console.log({ kbk, kbkHost });
};

const drillDownQueryKBNodes = async (
  chatDto: ChatDto,
  promptService: ScriptPromptService,
) => {
  const criteria = chatDto.data || {};
  chatDto = await promptService.process(chatDto, { to: '@TR#translate' });
  // eslint-disable-next-line prefer-const
  let { language, content: question } = chatDto.data;
  chatDto.text = question;

  const promptMatch = criteria.sbs
    ? 'please give elaborated bullet analysis step by step. finally reply a JSON object:'
    : 'please reply only a json object, no explanation:';

  // recursively drill down to answer.
  for (;;) {
    const { data: nodes } = await promptService.process(chatDto, {
      to: 'memory:nodes#match',
      docs: 'semantic match from list',
    });
    if (!nodes?.length) {
      chatDto.data = null;
      return chatDto;
    }

    // check
    const { text } = await promptService.process(chatDto, {
      to: 'llm',
      prompt: `given the content:\n{\n${JSON.stringify(
        nodes.map((v) => v.content),
      )}\n}\nIs the content enough to answer the question:\n{\n${question}\n}\n${promptMatch}
{enough:boolean,answer:"the precise answer in \`${language}\` language if enough"},question:"the more accurate question if not enough"}`,
    });
    const resp = promptService.toJSON(text);
    chatDto.data = resp.enough;
    chatDto.text = resp.enough ? resp.answer : resp.question;
    if (resp.enough) return chatDto;

    question = resp.question;
    criteria.parentIds = (nodes as any[]).map((v) => v.id);
    chatDto.data = criteria;
  }
};

const importKBNodes = async (
  chatDto: ChatDto,
  promptService: ScriptPromptService,
) => {
  if (chatDto.data) {
    chatDto = await promptService.process(chatDto, { to: 'memory:nodes#save' });
    return chatDto;
  }

  if (chatDto.text) {
    // FIXME chunk req.text
    throw new Error('unimplemented chunk req.text');
  }
};
