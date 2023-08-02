import { MemoryVersion, PrismaClient } from '@prisma/client';
import { ChatDto } from '../../src/actors/chats/dto/chat-dto';
import { AppConstant } from '../../src/app.constants';
import { ScriptPromptService } from '../../src/toolbox/plugins/builtin/script.tool';
import { KBKConstants } from '../kb-keeper.seed';
import { AppDIYConstants } from './appdiy.seed';

export async function createUIArchitect(prisma: PrismaClient) {
  const designerRoleDef = {
    id: AppDIYConstants.uiArchitectRoleId,
    nick: 'ui-architect',
    goal: 'to decide which UI development framework to use based on PRD and UI design.',
    skills: [
      'choose proper UI framework for project development',
      'initialize the UI project',
    ],
    professionals: ['UI architect developer'],
    createdBy: AppConstant.systemUsername,
    published: true,
    entries: [],
  };

  const designerHostId = AppDIYConstants.uiArchitectRoleId + '-host';
  const designerHostDef = {
    id: designerHostId,
    roleId: AppDIYConstants.uiArchitectRoleId,
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
      // {
      //   name: '',
      //   handle: {
      //     to: 'script',
      //     prompt: defaultEntryForwardNamedEntryHandle.toString(),
      //   },
      // },
      {
        name: 'choose-framework',
        description:
          "choose UI framework from @parent@BA's PRD and @parent@ui-designer's components",
        handle: {
          to: 'script',
          prompt: chooseUIFramework.toString(),
        },
      },
    ],
  };

  const uiArchitect = await prisma.role.upsert({
    where: { id: AppDIYConstants.uiArchitectRoleId },
    create: designerRoleDef,
    update: designerRoleDef,
  });
  const uiArchitectHost = await prisma.host.upsert({
    where: { id: designerHostId },
    create: designerHostDef,
    update: designerHostDef,
  });

  console.log({ uiArchitect, uiArchitectHost });
}

const chooseUIFramework = async (
  chatDto: ChatDto,
  promptService: ScriptPromptService,
) => {
  let { text: designVerKey } = chatDto;

  // load ui version
  chatDto.options.domain = 'UI';
  chatDto = await promptService.process(chatDto, {
    to: '@parent@ui-designer@KBK#version-count',
    prompt: designVerKey,
  });
  if (!chatDto.data?.version || !chatDto.data?.nodes)
    return { ...chatDto, statusCode: 404, message: 'UI design is empty.' };
  designVerKey = chatDto.data.version.key;
  const designVerId = chatDto.data.version.id;

  // load prd root node.
  chatDto.options.domain = 'PRD';
  chatDto = await promptService.process(chatDto, {
    to: '@parent@BA@KBK#version-count',
    prompt: designVerKey,
  });
  if (!chatDto.data?.version || !chatDto.data?.nodes)
    return { ...chatDto, statusCode: 404, message: 'PRD is empty.' };
  const prdVerId = chatDto.data.version.id;
  chatDto.data = { versionId: prdVerId };
  chatDto = await promptService.process(chatDto, {
    to: '@parent@BA@KBK#query',
  });
  const userStories: any[] = chatDto.data;
  if (!userStories?.length || chatDto.statusCode)
    return chatDto.statusCode
      ? chatDto
      : { ...chatDto, statusCode: 404, message: 'PRD is empty.' };
  const prdRoot = userStories[0];

  // load design some page components
  chatDto.options.domain = 'UI';
  chatDto.text = designVerId;
  chatDto = await promptService.process(chatDto, {
    to: '@parent@ui-designer@KBK#chains',
  });

  const pages = [],
    pageIds = new Set(),
    pageLevels = new Set(['system', 'module', 'page']);
  const chains = chatDto.data;
  for (const chain of chains) {
    // get page level
    const chain0 = (chain as any[]).reverse();
    for (const ui of chain0)
      if (pageLevels.has(ui.content?.level)) {
        if (!pageIds.has(ui.id)) {
          pageIds.add(ui.id);
          const content = { ...ui.content, stories: undefined };
          pages.push(JSON.stringify(content));
        }
        break;
      }
    if (pages.length > 9) break;
  }

  let { data: version } = await promptService.process(chatDto, {
    to: '@KBK#version',
    prompt: designVerKey,
  });
  if (version) {
    if (!!version.published)
      return {
        ...chatDto,
        statusCode: 409,
        message: `version conflict, ${version.key} is published`,
      };
  } else {
    chatDto = await promptService.process(chatDto, {
      to: '@KBK#upgrade',
      prompt: { key: designVerKey },
    });
    version = chatDto.data;
  }

  const prompt = `please act as a UI developer, to decide which UI framework to choose based on the requirement:
{
${prdRoot.content}
},
and UI design:
[${pages}],
reply as json: {"framework": "suggested framework", "project-name": "proper name for the project", "project-init-command": "Initialize the project using scaffolding tools"}`;

  chatDto.data = null;
  chatDto = await promptService.process(chatDto, {
    to: 'llm:quality=2',
    prompt,
  });
  const component = promptService.toJSON(chatDto.text);
  const node = {
    key: 'ui-framework',
    versionId: version.id,
    summary: component['project-init-command'],
    content: component,
  };

  chatDto.options.domain = 'UI';
  chatDto.data = [node];
  chatDto = await promptService.process(chatDto, {
    to: '@KBK#import',
  });
  delete chatDto.options.domain;
  return chatDto;
};
