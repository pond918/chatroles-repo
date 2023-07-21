import { PrismaClient } from '@prisma/client';
import { ChatDto } from '../../src/actors/chats/dto/chat-dto';
import { AppConstant } from '../../src/app.constants';
import { CreateMemoryNodeDto } from '../../src/memory-nodes/dto/create-memory-node.dto';
import { ScriptPromptService } from '../../src/toolbox/plugins/builtin/script.tool';
import { AppDIYConstants } from './appdiy.seed';

/**
 * 基于用户故事，撰写bdd cases，关联到故事树的叶子节点。不同故事可能具有相同的bdd case。
 */
export async function createBDDRole(prisma: PrismaClient) {
  const bizBDDRoleRole = {
    id: AppDIYConstants.bddRoleId,
    nick: 'BDD',
    goal: 'to write BDD cases based on PRD user stories, each case is related to a leaf user story.',
    skills: ['generate BDD cases from user stories'],
    professionals: ['BDD Analyst', 'BDD writer'],
    createdBy: AppConstant.systemUsername,
    published: true,
    entries: [],
  };

  const baHostId = AppDIYConstants.bddRoleId + '-host';
  const baHostDef = {
    id: baHostId,
    roleId: AppDIYConstants.bddRoleId,
    onEntries: [
      {
        name: 'generate',
        handle: { to: 'script', prompt: generateBDD.toString() },
      },
    ],
    createdBy: AppConstant.systemUsername,
    published: true,
    releasedNo: '0.1.0',
  };

  const ba = await prisma.role.upsert({
    where: { id: AppDIYConstants.bddRoleId },
    create: bizBDDRoleRole,
    update: bizBDDRoleRole,
  });
  const baHost = await prisma.host.upsert({
    where: { id: baHostId },
    create: baHostDef,
    update: baHostDef,
  });

  console.log({ ba, baHost });
}

/**
 * 1. 遍历故事链
 * 2. 生成cases
 * 3. 查重，去重，重构，挂在stories tree leaf
 */
const generateBDD = async (
  chatDto: ChatDto,
  promptService: ScriptPromptService,
) => {
  // 1. 指定版本(或最新draft)，遍历故事链，一次全生成
  const { text: versionKey } = chatDto;
  const { data: version } = await promptService.process(chatDto, {
    to: '@parent@BA@KBK#version',
    prompt: '', // get latest, only the latest is allowed to change
  });
  if (
    !version ||
    (versionKey && version.key != versionKey) ||
    !!version.published
  )
    return {
      ...chatDto,
      statusCode: 404,
      message: `No draft version found to generate BDD cases, ${version?.key}`,
    };

  chatDto.options.domain = 'PRD';
  chatDto = await promptService.process(chatDto, {
    to: '@parent@BA@KBK#chains',
    prompt: version.id,
  });
  if (!chatDto.data?.length)
    return {
      ...chatDto,
      statusCode: 404,
      message: `PRD is empty, cannot generate BDD cases, ${version.key}`,
    };

  const parseGherkinCases = (
    storyId: string,
    text: string,
    features: Map<string, string[][]>,
  ) => {
    let currentFeature = '';
    let currentScenario: string[];

    // Split the text into lines
    const lines = text.split('\n');

    for (let line of lines) {
      line = line.trim();

      const f = line.search(/^\s*Feature:/) >= 0,
        sc = !f && line.search(/^\s*Scenario:/) >= 0;
      if (f || sc) {
        // Save the previous scenario and start a new one
        if (currentScenario?.length > 0) {
          let scenarios = features.get(currentFeature);
          scenarios || features.set(currentFeature, (scenarios = []));
          scenarios.push(currentScenario);
        }
        if (f) {
          currentFeature = line;
          currentScenario = null;
        } else currentScenario = [storyId, line]; // new scenario
      } else if (line && currentScenario) {
        currentScenario.push(line);
      }
    }

    // Save the last scenario
    if (currentScenario.length > 0) {
      let scenarios = features.get(currentFeature);
      scenarios || features.set(currentFeature, (scenarios = []));
      scenarios.push(currentScenario);
    }

    return features;
  };

  // Map<feature, [[storyId, ...scenarioLines]]>
  const features = new Map<string, string[][]>();
  const chains = chatDto.data;
  chatDto.data = null;
  for (const chain of chains) {
    const content = chain.reduce(
      (pre: string, n: any) =>
        pre +
        (typeof n.content == 'string' ? n.content : JSON.stringify(n.content)),
      '',
    );
    chatDto.options.stateless = true;
    chatDto = await promptService.process(chatDto, {
      to: 'llm:quality=2',
      prompt: `Given the requirement and part of the user stories chain:
${content}
generate all BDD cases in English into a single Gherkin markdown code block for acceptance/coverage test.`,
    });
    let bddContent = chatDto.text;

    // parse Gherkin code block
    let idx = bddContent.search(/(^|\n)```/); // block start
    const errorResp = {
      ...chatDto,
      statusCode: 500,
      message: 'Format error generating BDD cases from LLM.',
    };
    if (idx < 0) return errorResp;
    idx = bddContent.indexOf('\n', idx);
    if (idx < 0) return errorResp;
    bddContent = bddContent.substring(idx + 1);

    idx = bddContent.indexOf('\n```'); // block end
    if (idx < 0) return errorResp;
    bddContent = bddContent.substring(0, idx);

    parseGherkinCases(chain.at(-1).id, bddContent, features);
  }

  // merge similar features, Map<feature, [[scenarioKey, [storyIds], content]]>
  const nodes: CreateMemoryNodeDto[] = [];
  const mergedFeatures = new Map<string, string[][]>();
  let featureMap: object;
  const fNames = Array.from(features.keys());
  do {
    chatDto = await promptService.process(chatDto, {
      to: 'llm:quality=2',
      prompt: `Given the BDD cases \`Features\` array:
${JSON.stringify(fNames)}
Please merge similar features and re-organize as json object:
{"original feature":"mapped new feature"}
Note: json must contain all features in array!`,
    });
    featureMap = promptService.toJSON(chatDto.text);
  } while (!fNames.reduce((pre, f) => pre && f in featureMap, true));
  for (const [feat, scs] of features.entries()) {
    const newFeature = featureMap[feat];
    let scenarios = mergedFeatures.get(newFeature);
    scenarios || mergedFeatures.set(newFeature, (scenarios = []));
    scenarios.push(...scs);
  }

  // merge similar cases
  let featureKey = 1;
  // TODO content may TOO long
  for (const [feat, scs] of mergedFeatures.entries()) {
    const cases = {};
    scs.map((lines, index) => {
      cases[index + ''] = lines.slice(1).join('\n');
    });
    if (scs.length > 1) {
      chatDto = await promptService.process(chatDto, {
        to: 'llm:quality=2',
        prompt: `Given the BDD cases array for \`${feat}\`:
${JSON.stringify(cases)}
Please merge similar cases and re-organize as json array:
[
  ["the merged Gherkin case with full plain text",[...original_case_indices]]  
]`,
      });
    }
    const mergedCases =
      scs.length > 1
        ? promptService.toJSON(chatDto.text, true)
        : [[cases['0'], [0]]];
    let scenarioKey = 1;
    for (let index = 0; index < mergedCases.length; index++) {
      const [scenario, indices] = mergedCases[index];
      const node: CreateMemoryNodeDto = {
        key: `F${featureKey.toString().padStart(2, '0')}-S${scenarioKey
          .toString()
          .padStart(2, '0')}`,
        versionId: version.id,
        actorId: version.actorId,
        content: scenario,
      };
      const dupNodes = new Set();
      for (let idx = 0; idx < indices.length; idx++) {
        const parentId = scs[indices[idx]][0];
        if (!dupNodes.has(parentId)) {
          nodes.push({ ...node, parentId });
          dupNodes.add(parentId);
        }
      }
      scenarioKey++;
    }
    featureKey++;
  }

  // save nodes into BA role
  chatDto.data = nodes;
  chatDto.options.domain = 'BDD';
  delete chatDto.options.stateless;
  return promptService.process(chatDto, { to: '@parent@BA@KBK#import' });
};
