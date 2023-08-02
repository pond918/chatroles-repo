import { MemoryVersion, PrismaClient } from '@prisma/client';
import { ChatDto } from '../../src/actors/chats/dto/chat-dto';
import { AppConstant } from '../../src/app.constants';
import { ScriptPromptService } from '../../src/toolbox/plugins/builtin/script.tool';
import { KBKConstants } from '../kb-keeper.seed';
import { AppDIYConstants } from './appdiy.seed';

/**
 * 基于需求/UI/域服务，设计BFF层APIs.
 * BFF层负责将域服务串/并联为UI需要的APIs。
 */
export async function createBFFDesigner(prisma: PrismaClient) {
  const designerRoleDef = {
    id: AppDIYConstants.bffRoleId,
    nick: 'bff-api-designer',
    goal: 'to design BFF APIs from PRD/UI/domain services.',
    skills: [
      'design backend-for-frontend(BFF) APIs from PRD/UI/domain services',
    ],
    professionals: ['BFF APIs designer'],
    createdBy: AppConstant.systemUsername,
    published: true,
    entries: [],
  };

  const designerHostId = AppDIYConstants.bffRoleId + '-host';
  const designerHostDef = {
    id: designerHostId,
    roleId: AppDIYConstants.bffRoleId,
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
          'generate BFF APIs by iterating all UI related stories, and existing APIs',
        handle: {
          to: 'script',
          prompt: generateBffAPIsHandle.toString(),
        },
      },
    ],
  };

  const designer = await prisma.role.upsert({
    where: { id: AppDIYConstants.bffRoleId },
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

const generateBffAPIsHandle = async (
  chatDto: ChatDto,
  promptService: ScriptPromptService,
) => {
  let { text: appVerKey } = chatDto;

  // load bff version
  let bffVersion: MemoryVersion;
  chatDto.options.domain = 'BFF';
  chatDto = await promptService.process(chatDto, {
    to: '@KBK#version-count',
    prompt: appVerKey,
  });
  if (!chatDto.data?.version) {
    chatDto = await promptService.process(chatDto, {
      to: '@KBK#upgrade',
      prompt: appVerKey,
    });
    bffVersion = chatDto.data;
  } else {
    if (chatDto.data.version.published)
      return {
        ...chatDto,
        statusCode: 409,
        message: 'Cannot change the published BFF version: ' + appVerKey,
      };

    bffVersion = chatDto.data.version;
  }

  // check ui version exists
  chatDto.options.domain = 'UI';
  chatDto = await promptService.process(chatDto, {
    to: '@parent@ui-designer@KBK#version-count',
    prompt: appVerKey,
  });
  if (!chatDto.data?.version || !chatDto.data?.nodes)
    return { ...chatDto, statusCode: 404, message: 'UI design is empty.' };
  appVerKey = chatDto.data.version.key;
  const uiVerId = chatDto.data.version.id;

  // load ui version nodes
  chatDto.data = { versionId: uiVerId };
  chatDto = await promptService.process(chatDto, {
    to: '@parent@ui-designer@KBK#query',
  });
  const uiNodes: any[] = chatDto.data;
  if (!uiNodes?.length || chatDto.statusCode)
    return chatDto.statusCode
      ? chatDto
      : { ...chatDto, statusCode: 404, message: 'UI design is empty.' };

  // gather stories with components
  // map<story-key, [ui-nodes]>
  const storyUIsMap = new Map<string, any[]>();
  for (const ui of uiNodes) {
    if (!ui.content?.stories?.length) continue;
    for (const storyKey of ui.content.stories) {
      let uis = storyUIsMap.get(storyKey);
      uis || storyUIsMap.set(storyKey, (uis = []));
      uis.push(ui);
    }
  }

  // check prd version exists
  chatDto.options.domain = 'PRD';
  chatDto = await promptService.process(chatDto, {
    to: '@parent@BA@KBK#version-count',
    prompt: appVerKey,
  });
  if (!chatDto.data?.version || !chatDto.data?.nodes)
    return { ...chatDto, statusCode: 404, message: 'PRD is empty.' };
  appVerKey = chatDto.data.version.key;
  const prdVerId = chatDto.data.version.id;

  // iterate each detailed user story to generate APIs
  for (const [storyKey, uiNodes] of storyUIsMap.entries()) {
    // get story
    chatDto.options.domain = 'PRD';
    chatDto.data = { key: storyKey, versionId: prdVerId };
    chatDto = await promptService.process(chatDto, {
      to: '@parent@BA@KBK#get',
    });
    const story = chatDto.data;

    // get related components' bff APIs
    ;

    // get semantic domain model services,

    // generate in context
  }

  /**
   * iterate prd nodes[root, parent, siblings], get parent related comps,
   * eval subset of related comps for curNode, record it
   * split/refine/create comps, (may not split)
   * replace new comps of related comps to curNode(do'not change un-splitted comps)
   */
  const _generateBFFNodes = async (
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
[{key:"unique-component-key",level:"one of: system|module|page|panel|combo|element",type:"standard UI component type",description:"component description",parent:"parent component key, or null if root",details:"detailed design",stories:["only the sibling user story keys which uses the component"]}]`;

    chatDto = await promptService.process(chatDto, {
      to: 'llm:quality=2',
      prompt,
    });
    const components = promptService.toJSON(chatDto.text); // including old comps?
    // 3. convert components to nodes for upsert
    // map<storyKey, components>
    for (const c of components) {
      const parentId = storyUIsMap.get(c.parent || 'ui-design-root')?.id;
      if (!parentId) return; // FIXME
      const uiNode = {
        id: await promptService.uuid(),
        key: c.key,
        parentId,
        versionId: bffVersion.id,
        summary: c.description,
        content: {
          key: c.key,
          type: c.type,
          description: c.description,
          stories: c.stories,
        },
      };
      storyUIsMap.set(c.key, uiNode);
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
  chatDto.data = Array.from(storyUIsMap.values());
  chatDto = await promptService.process(chatDto, {
    to: '@KBK#import',
  });
  delete chatDto.options.domain;
  return chatDto;
};
