import { Actor, PrismaClient } from '@prisma/client';
import { defaultEntryForwardNamedEntryHandle } from '../../src/actors/chats/actor-default.entries';
import { ChatDto } from '../../src/actors/chats/dto/chat-dto';
import { AppConstant } from '../../src/app.constants';
import { ScriptPromptService } from '../../src/toolbox/plugins/builtin/script.tool';
import { KBKConstants } from '../kb-keeper.seed';
import { AppDIYConstants } from './appdiy.seed';
import { CreateMemoryNodeDto } from '../../src/memory-nodes/dto/create-memory-node.dto';

/**
 * 输入用户需求，理解用户追求的价值，分解用户故事和用例
 */
export async function createRequirementAnalyst(prisma: PrismaClient) {
  const bizRequirementAnalystRole = {
    id: AppDIYConstants.baRoleId,
    nick: 'BA',
    goal: "to generate PRD(user stories and use cases), based on user's business requirements.",
    help: 'this role is as an executor to break down requirements,\
result in a user stories tree. each leaf story is further broken down to use cases.\
NOTE: stories focus on user requirements and values, while use cases focus on implementation.',
    skills: [
      'Interview users to understand their requirements',
      "Analyze the requirements to understand users' true value",
      "generate PRD(tree of user stories and use cases) according to the 'INVEST' principle, to reflect user's complete value",
    ],
    professionals: ['Business Requirement Analyst', 'BA'],
    createdBy: AppConstant.systemUsername,
    published: true,
    entries: [],
  };

  const baHostId = AppDIYConstants.baRoleId + '-host';
  const baHostDef = {
    id: baHostId,
    roleId: AppDIYConstants.baRoleId,
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
        name: 'generate',
        handle: { to: 'script', prompt: generatePRD.toString() },
      },
    ],
    createdBy: AppConstant.systemUsername,
    published: true,
    releasedNo: '0.1.0',
  };

  const ba = await prisma.role.upsert({
    where: { id: AppDIYConstants.baRoleId },
    create: bizRequirementAnalystRole,
    update: bizRequirementAnalystRole,
  });
  const baHost = await prisma.host.upsert({
    where: { id: baHostId },
    create: baHostDef,
    update: baHostDef,
  });

  console.log({ ba, baHost });
}

/**
 * 1. 指定要break的node key(不指定表示root)，以及requirements
 * 2. load siblings(completeness) & root requirement(for goal) & query related existing nodes(for overlaps),
 * 3. break current node, prevent overlap with other nodes, 生成children（stories or use cases）
 * 4. 用户确认，确认后保存/放弃
 * 5. 保存前清除该node所有子节点
 * 6. 询问是否继续，若是请指定node，跳转#2
 * 7. 否则结束
 */
const generatePRD = async (
  chatDto: ChatDto,
  promptService: ScriptPromptService,
  ctx: Record<string, any>,
  actor: Actor,
) => {
  chatDto.data || (chatDto.data = {});
  chatDto.options.domain = 'PRD';

  let {
    // eslint-disable-next-line prefer-const
    text: requirement,
    // eslint-disable-next-line prefer-const
    data: { nodeKey, versionKey, language }, // node to break for the PRD version, empty means root of latest version
  } = chatDto;

  // 1. 指定要break的node key(不指定表示root)，以及requirements
  // 只允许最新的1个draft version
  let { data: version } = await promptService.process(chatDto, {
    to: '@KBK#version',
    prompt: '', // get latest, only the latest is allowed to change
  });
  if (version) {
    if ((version.key == versionKey) == !!version.published)
      return {
        ...chatDto,
        statusCode: 409,
        message: `version conflict, ${version.key} is ${
          version.published ? '' : 'not '
        } published`,
      };

    if (version.published) version = null;
    else {
      if (language) version.language = language;
      else language = version.language;
    }
  }
  if (!version) {
    chatDto = await promptService.process(chatDto, {
      to: '@KBK#upgrade',
      prompt: { key: versionKey, language },
    });
    version = chatDto.data;
  }

  let rootPrd: CreateMemoryNodeDto,
    nodeSiblings: CreateMemoryNodeDto[] = [];

  // 2. load siblings(completeness) & root requirement(for goal) & query related existing nodes(for overlaps),
  const generateByNodeKey = async (nodeKey: string) => {
    let currentNode: CreateMemoryNodeDto,
      relatedNodes = [];
    if (nodeKey) {
      currentNode = nodeSiblings.find((n) => n.key == nodeKey);
      if (!currentNode) {
        // query siblings by node key
        chatDto = await promptService.process(chatDto, {
          to: '@KBK#get',
          prompt: { key: nodeKey, versionId: version.id },
        });
        currentNode = chatDto.data;
        if (!currentNode)
          return {
            ...chatDto,
            statusCode: 404,
            message: 'PRD node not found: ' + nodeKey,
          };

        chatDto = await promptService.process(chatDto, {
          to: '@KBK#query',
          prompt: {
            parentIds: [currentNode.parentId],
            versionId: version.id,
            count: 100,
          },
        });
        nodeSiblings = chatDto.data;
      }
      if (!rootPrd) {
        chatDto = await promptService.process(chatDto, {
          to: '@KBK#query',
          prompt: { versionId: version.id },
        });
        rootPrd = chatDto.data[0];
      }
      // FIXME find related nodes
      relatedNodes = [];
    } else {
      nodeSiblings[0] = // do not save before confirmation
        currentNode =
        rootPrd =
          {
            key: (nodeKey = 'prd-root'),
            versionId: version.id,
            actorId: actor.id,
            content: requirement,
          };
    }

    // 3. break current node, prevent overlap with other nodes, 生成children（stories or use cases）
    let prompt = `break the ${
      nodeKey == 'prd-root' ? '`requirement' : 'user story `' + nodeKey
    }\` down into sub user stories${
      language ? ' with language ' + language : ''
    },
fully obey the \`INVEST\` principle, The stories should be concise/complete;
reply a json array( or empty array if unbreakable) without explanation:
[{"key":"${
      nodeKey == 'prd-root' ? 'US-0x' : nodeKey + '-0x'
    }","summary":"summary in 10 keywords at most","userStory":"detailed user story description","acceptanceCriteria":["criteria array"]},...].
# \`requirement\`:\n{\n${requirement}\n}`;
    if (nodeSiblings[0].key != 'prd-root')
      prompt += `\n# current user stories:\n${[
        ...nodeSiblings,
        ...relatedNodes,
      ].map((n) =>
        typeof n.content == 'string' ? n.content : JSON.stringify(n.content),
      )}`;
    if (nodeKey == 'prd-root')
      prompt += `\nstrictly prevent overlap among stories!`;
    else
      prompt += `\nrestrict new sub stories only for \`${nodeKey}\`, and prevent overlap with other existing stories!`;

    chatDto.options.stateless = true;
    chatDto = await promptService.process(chatDto, {
      to: 'llm:quality=2',
      prompt,
    });
    delete chatDto.options.stateless;

    // send user-command to wait for user confirm
    return await promptService.process(
      chatDto,
      {
        to: 'user-command:start',
        prompt:
          'please adjust if necessary, to confirm the user stories are CORRECT, CLEAR and COMPLETE. existing nodes will be REMOVED!',
      },
      async (dto) => {
        // 4. 用户确认，确认后保存/放弃
        if (dto.statusCode) return dto;

        const { text } = dto;
        let newNodes = promptService.toJSON(text, true);
        if (!newNodes?.length) return dto; // to the leaf

        if (!currentNode.id) {
          // get old root
          chatDto = await promptService.process(chatDto, {
            to: '@KBK#query',
            prompt: { versionId: version.id },
          });
          if (chatDto.data?.length) {
            // clear whole prd
            chatDto = await promptService.process(chatDto, {
              to: '@KBK#remove',
              prompt: [chatDto.data[0].id],
            });
          }
          // save new root prd
          chatDto = await promptService.process(chatDto, {
            to: '@KBK#import',
            prompt: [currentNode],
          });
          nodeSiblings[0] = currentNode = rootPrd = chatDto.data[0];
        }

        newNodes = newNodes.map((n: any) => ({
          key: n.key,
          content: n,
          summary: n.summary,
          versionId: version.id,
          parentId: currentNode.id,
        }));

        // 5. 保存前清除该node所有子节点
        chatDto = await promptService.process(chatDto, {
          to: '@KBK#remove-subs',
          prompt: [currentNode.id],
        });
        chatDto.data = newNodes;
        chatDto = await promptService.process(chatDto, {
          to: '@KBK#import',
          prompt: newNodes,
        });

        // 6. 询问是否继续，若是请指定node，跳转#2
        return await promptService.process(
          chatDto,
          { to: 'user-command:start', prompt: 'continue to generate?' },
          async (dto) => {
            if (dto.statusCode || !dto.text) return dto;
            // 7. 若是请指定node，跳转#2
            return await generateByNodeKey(dto.text);
          },
        );
      },
    );
  };

  return await generateByNodeKey(nodeKey);
};
