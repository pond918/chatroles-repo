import { MemoryVersion, PrismaClient } from '@prisma/client';
import { ChatDto } from '../../src/actors/chats/dto/chat-dto';
import { AppConstant } from '../../src/app.constants';
import { ScriptPromptService } from '../../src/toolbox/plugins/builtin/script.tool';
import { KBKConstants } from '../kb-keeper.seed';
import { AppDIYConstants } from './appdiy.seed';

export async function createUIDesigner(prisma: PrismaClient) {
  const designerRoleDef = {
    id: AppDIYConstants.uiDesignerRoleId,
    nick: 'ui-designer',
    goal: 'to design UI components from PRD.',
    skills: ['design UI from PRD', 'request to refine PRD if needed'],
    professionals: ['UI designer'],
    createdBy: AppConstant.systemUsername,
    published: true,
    entries: [],
  };

  const designerHostId = AppDIYConstants.uiDesignerRoleId + '-host';
  const designerHostDef = {
    id: designerHostId,
    roleId: AppDIYConstants.uiDesignerRoleId,
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
        name: 'generate',
        description:
          'generate ui from @parent@BA\'s PRD, dto{ text: "requirement to the design, like OS, theme, etc.", data: "PRD version, empty means newest." }',
        handle: {
          to: 'script',
          prompt: generateUINodesHandle.toString(),
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
    ],
  };

  const designer = await prisma.role.upsert({
    where: { id: AppDIYConstants.uiDesignerRoleId },
    create: designerRoleDef,
    update: designerRoleDef,
  });
  const designerHost = await prisma.host.upsert({
    where: { id: designerHostId },
    create: designerHostDef,
    update: designerHostDef,
  });

  console.log({ designer, designerHost });
}

/**
 * generate ui from prd, existing draft will all be cleared.
 *
 * 遍历prd nodes，基于sub-stories只关联node部分组件的事实，
 * 将组件多对多关联到prd nodes上，且组层向内细化.
 */
const generateUINodesHandle = async (
  chatDto: ChatDto,
  promptService: ScriptPromptService,
) => {
  // eslint-disable-next-line prefer-const
  let { text: designRequirement, data: prdVerKey } = chatDto;
  if (typeof prdVerKey != 'string') prdVerKey = '';
  let designVersion: MemoryVersion;

  // load PRD version
  chatDto.options.domain = 'PRD';
  chatDto = await promptService.process(chatDto, {
    to: '@parent@BA@KBK#version-count',
    prompt: prdVerKey,
  });
  if (!chatDto.data?.version || !chatDto.data?.nodes)
    return { ...chatDto, statusCode: 404, message: 'PRD is empty.' };
  prdVerKey = chatDto.data.version.key;
  const prdVerId = chatDto.data.version.id;

  // clear existing design draft
  chatDto.options.domain = 'UI';
  chatDto = await promptService.process(chatDto, {
    to: '@KBK#version-count',
    prompt: prdVerKey,
  });
  if (!chatDto.data?.version) {
    chatDto = await promptService.process(chatDto, {
      to: '@KBK#upgrade',
      prompt: prdVerKey,
    });
    designVersion = chatDto.data;
  } else {
    if (chatDto.data.version.published)
      return {
        ...chatDto,
        statusCode: 409,
        message: 'Cannot change the published design version: ' + prdVerKey,
      };

    designVersion = chatDto.data.version;
    if (chatDto.data?.nodes) {
      // FIXME: confirm
      chatDto = await promptService.process(chatDto, {
        to: '@KBK#version-reset',
        prompt: chatDto.data.version.id,
      });
    }
  }

  // load prd root node.
  chatDto.options.domain = 'PRD';
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

  // map<key, node>
  const resultNodesMap = new Map<string, any>();
  resultNodesMap.set('ui-design-root', {
    id: await promptService.uuid(),
    key: 'ui-design-root',
    versionId: designVersion.id,
    summary: 'app UI design root',
    content: {
      key: 'ui-design-root',
      type: 'ui-design-root',
      description: 'app UI design root',
      stories: [prdRoot.key],
    },
  });
  /**
   * iterate prd nodes[root, parent, siblings], get parent related comps,
   * eval subset of related comps for curNode, record it
   * split/refine/create comps, (may not split)
   * replace new comps of related comps to curNode(do'not change un-splitted comps)
   */
  const _generateUINodes = async (
    parentStory: any,
    parentComponents: any[],
  ) => {
    // 1. sibling stories, TODO query BDD?
    chatDto.data = { parentIds: [parentStory.id], count: 100 };
    chatDto = await promptService.process(chatDto, {
      to: '@parent@BA@KBK#query',
    });
    if (!chatDto.data?.length) return;
    const relatedComponents = new Map<string, any[]>();
    const siblings = chatDto.data;
    const siblingsTxt = siblings.map((v) => {
      relatedComponents.set(v.key, []);
      return JSON.stringify(v.content);
    });
    const parentComponentsTxt = parentComponents.map((v) => JSON.stringify(v));

    // 2. split/refine/create sub components
    // also persist relations to each sibling, TODO how to store
    // break node
    // [root, parent, siblings, components]
    let prompt = `please act as a UI designer for requirement:
{
${prdRoot.content}
},${designRequirement ? `{\n${designRequirement}\n}` : ''}
given the related sibling user stories:
[${siblingsTxt}]
`;
    if (parentComponents.length) {
      prompt += `under story: ${JSON.stringify(parentStory.content)},
which is related to the UI components:
[${parentComponentsTxt}].
please split/refine the components, or add necessary components `;
    } else prompt += 'please create UI components ';
    prompt += `based on the stories, reply a json array:
[{key:"unique-component-key",type:"standard UI component type",description:"component description",parent:"parent component key, or null if root",details:"detailed design",stories:["only the sibling user story keys which uses the component"]}]`;

    chatDto = await promptService.process(chatDto, {
      to: 'llm:quality=2',
      prompt,
    });
    const components = promptService.toJSON(chatDto.text); // including old comps?
    // 3. convert components to nodes for upsert
    // map<storyKey, components>
    for (const c of components) {
      const parentId = resultNodesMap.get(c.parent || 'ui-design-root')?.id;
      if (!parentId) return; // FIXME
      const uiNode = {
        id: await promptService.uuid(),
        key: c.key,
        parentId,
        versionId: designVersion.id,
        summary: c.description,
        content: {
          key: c.key,
          type: c.type,
          description: c.description,
          stories: c.stories,
        },
      };
      resultNodesMap.set(c.key, uiNode);
      for (const storyKey of c.stories) {
        const comps = relatedComponents.get(storyKey);
        if (!comps) continue;
        comps.push({ ...uiNode.content, stories: undefined });
      }
    }

    // 4. recursive
    for (const s of siblings) {
      // related components
      await _generateUINodes(s, relatedComponents.get(s.key));
    }
  };
  await _generateUINodes(prdRoot, []);

  chatDto.options.domain = 'UI';
  chatDto.data = Array.from(resultNodesMap.values());
  chatDto = await promptService.process(chatDto, {
    to: '@KBK#import',
  });
  delete chatDto.options.domain;
  return chatDto;
};
