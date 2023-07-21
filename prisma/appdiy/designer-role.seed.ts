import { MemoryVersion, PrismaClient } from '@prisma/client';
import { ChatDto } from '../../src/actors/chats/dto/chat-dto';
import { AppConstant } from '../../src/app.constants';
import { ScriptPromptService } from '../../src/toolbox/plugins/builtin/script.tool';
import { AppDIYConstants } from './appdiy.seed';
import { defaultEntryForwardNamedEntryHandle } from '../../src/actors/chats/actor-default.entries';
import { KBKConstants } from '../kb-keeper.seed';

export async function createDesigner(prisma: PrismaClient) {
  const designerRole = {
    id: AppDIYConstants.designerRoleId,
    nick: 'designer',
    goal: 'to design UI/APIs from PRD.',
    skills: ['design UI/APIs from PRD', 'request to refine PRD if needed'],
    professionals: ['UI designer', 'API designer'],
    createdBy: AppConstant.systemUsername,
    published: true,
    entries: [],
  };

  const designerHostId = AppDIYConstants.designerRoleId + '-host';
  const designerHostDef = {
    id: designerHostId,
    roleId: AppDIYConstants.designerRoleId,
    createdBy: AppConstant.systemUsername,
    published: true,
    releasedNo: '0.0.1',
    members: [
      {
        name: 'KBK',
        earlyCreate: false,
        hostId: KBKConstants.kbKeeperRoleId + '-host',
        roleId: KBKConstants.kbKeeperRoleId,
      },
    ],
    onEntries: [
      {
        name: '',
        handle: {
          to: 'script',
          prompt: defaultEntryForwardNamedEntryHandle.toString(),
        },
      },
      {
        name: 'generate-ui',
        description:
          'generate ui from stories, dto{text:"type of software", data: userStoriesArray}',
        handle: {
          to: 'script',
          prompt: generateUINodesHandle.toString(),
          responses: [
            {
              then: {
                to: 'user-command:start',
                prompt: 'please adjust if necessary',
              },
            },
            { then: { to: 'json:array' } },
            {
              then: {
                to: 'script',
                prompt: generateUIComponentsHandle.toString(),
              },
            },
          ],
        },
      },
      {
        name: 'append-ui',
        description: 'append ui from stories',
        handle: { to: 'script', prompt: ''.toString() },
      },
      {
        name: 'refine-ui',
        description: 'refine specific ui node',
        handle: { to: 'script', prompt: ''.toString() },
      },
      {
        name: 'design-api',
        handle: { to: 'script', prompt: ''.toString() },
      },
      {
        name: 'refine-api',
        handle: { to: 'script', prompt: ''.toString() },
      },
    ],
  };

  const designer = await prisma.role.upsert({
    where: { id: AppDIYConstants.designerRoleId },
    create: designerRole,
    update: designerRole,
  });
  const designerHost = await prisma.host.upsert({
    where: { id: designerHostId },
    create: designerHostDef,
    update: designerHostDef,
  });

  console.log({ designer, designerHost });
}

/** generate ui from prd, existing draft will all be cleared */
const generateUINodesHandle = async (
  chatDto: ChatDto,
  promptService: ScriptPromptService,
) => {
  // const { text, data } = chatDto;
  let designVersion: MemoryVersion;

  // clear existing draft
  chatDto = await promptService.process(chatDto, {
    to: '@KBK#version-count',
    prompt: '',
  });
  if (!chatDto.data?.version || chatDto.data.version.published) {
    chatDto = await promptService.process(chatDto, {
      to: '@KBK#upgrade',
      prompt: '0.0.1', // FIXME, language
    });
    designVersion = chatDto.data;
  } else {
    designVersion = chatDto.data.version;
    if (chatDto.data?.nodes) {
      // FIXME: confirm
      chatDto = await promptService.process(chatDto, {
        to: '@KBK#version-reset',
        prompt: '<<req.data.version.id>>',
      });
    }
  }

  // load prd root node
  chatDto.data = {};
  chatDto = await promptService.process(chatDto, {
    to: '@parent@BA@KBK#query',
  });
  let userStories: any[] = chatDto.data;
  if (!userStories?.length || chatDto.statusCode)
    return chatDto.statusCode
      ? chatDto
      : { ...chatDto, statusCode: 404, message: 'PRD is empty.' };
  const prdRoot = userStories[0];

  const resultNodes = [];
  let nodes = [
    {
      id: await promptService.uuid(),
      key: 'ui-design-root',
      versionId: designVersion.id,
      summary: 'app UI design root',
      content: {
        type: 'ui-design-root',
        description: 'app UI design root',
        stories: [userStories[0].key],
      },
    },
  ];

  for (; nodes.length; ) {
    resultNodes.push(...nodes); // new nodes added
    const subNodes = [],
      subStories = [];
    for (const node of nodes) {
      if (!node.content?.stories?.length) continue;

      // get sub stories
      const parentIds = userStories.reduce(
        (pre, us: any) => (
          node.content.stories.indexOf(us.key) < 0 || pre.push(us.id), pre
        ),
        [],
      );
      chatDto.data = { parentIds, count: 100 };
      chatDto = await promptService.process(chatDto, {
        to: '@parent@BA@KBK#query',
      });
      if (!chatDto.data?.length) continue;
      subStories.push(...chatDto.data);
      const stories = chatDto.data.map((n) => n.content);

      // break node
      chatDto = await promptService.process(chatDto, {
        to: 'llm:quality=2',
        prompt: `please act as a UI designer for requirement:
{
${prdRoot.content}
},
given the related user stories:
[${stories}]
please group stories by UI sub-components under parent component:{key:"${node.key}",type:"${node.content.type}",description:"${node.content.description}"},
reply a json array(exclude "${node.key}"):
[{key:"unique component key, or null if '${node.key}' has no sub",type:"standard UI component type",description:"component description",page:"page uri the component belongs to",stories:["user story key which uses the component"]}]`,
      });
      const subs = promptService.toJSON(chatDto.text);

      // convert to sub-nodes
      if (!subs?.length) continue;
      for (const sub of subs) {
        if (sub.key == node.key) continue;
        subNodes.push({
          id: await promptService.uuid(),
          key: sub.key,
          parentId: node.id,
          versionId: designVersion.id,
          summary: sub.description,
          content: {
            type: sub.type,
            description: sub.description,
            stories: sub.stories,
          },
        });
      }
    }
    [nodes, userStories] = [subNodes, subStories];
  }

  chatDto.options.domain = 'UI';
  chatDto.data = resultNodes;
  chatDto = await promptService.process(chatDto, {
    to: '@KBK#import',
  });
  delete chatDto.options.domain;
};

/** 遍历分解每个页面的组件 */
const generateUIComponentsHandle = async (
  chatDto: ChatDto,
  promptService: ScriptPromptService,
  ctx: Record<string, any>,
) => {
  const { data: pages } = chatDto;

  if (!pages?.length)
    return { ...chatDto, statusCode: 404, message: 'NO UI pages to design..' };

  const resultNodes = [];
  const version = await ctx['current_version'];
  if (!version)
    return {
      ...chatDto,
      statusCode: 404,
      message: '`current_version` not found in ctx',
    };

  // break page layout/components/interactions
  for (let page of pages) {
    // { versionId!, parentId?, key!, summary, content! }
    page = {
      id: await promptService.uuid(),
      key: page.uri,
      versionId: version.id,
      summary: page.title,
      content: page,
    };
    resultNodes.push(page);

    // break the page
    // inquire BA for the page
  }
};
