import { PrismaClient } from '@prisma/client';
import { ChatDto } from '../../src/actors/chats/dto/chat-dto';
import { AppConstant } from '../../src/app.constants';
import { ScriptPromptService } from '../../src/toolbox/plugins/builtin/script.tool';
import { AppDIYConstants } from './appdiy.seed';
import { defaultEntryForwardNamedEntryHandle } from '../../src/actors/chats/actor-default.entries';

export async function createProductManager(prisma: PrismaClient) {
  const productManagerRole = {
    id: AppDIYConstants.pmRoleId,
    nick: 'PM',
    goal: 'to handle user requirement, coordinate among user/members, break requirement tasks for user/members to process.',
    skills: [
      'analyze user requirements, forward to user/members to process, submit final results',
      'coordinate among user/members for requests and responses',
    ],
    professionals: ['Product Manager', 'PM'],
    createdBy: AppConstant.systemUsername,
    published: true,
    entries: [
      {
        name: 'request-query',
        description: 'query member kbs for result',
      },
      {
        name: 'request-write',
        description: 'generate/refine member kbs',
      },
    ],
  };

  const pmHostId = AppDIYConstants.pmRoleId + '-host';
  const pmHostDef = {
    id: pmHostId,
    roleId: AppDIYConstants.pmRoleId,
    createdBy: AppConstant.systemUsername,
    published: true,
    releasedNo: '0.0.1',
    members: [
      {
        name: 'BA',
        earlyCreate: false,
        hostId: AppDIYConstants.baRoleId + '-host',
        roleId: AppDIYConstants.baRoleId,
      },
      {
        name: 'designer',
        earlyCreate: false,
        hostId: AppDIYConstants.designerRoleId + '-host',
        roleId: AppDIYConstants.designerRoleId,
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
        name: 'request-query',
        description: 'query member kbs for result',
      },
      {
        name: 'request-write',
        description: 'import/generate/refine member kbs',
        handle: {
          to: 'script',
          prompt: requestWriteHandle.toString(),
        },
      },
    ],
  };

  const pm = await prisma.role.upsert({
    where: { id: AppDIYConstants.pmRoleId },
    create: productManagerRole,
    update: productManagerRole,
  });
  const pmHost = await prisma.host.upsert({
    where: { id: pmHostId },
    create: pmHostDef,
    update: pmHostDef,
  });

  console.log({ pm, pmHost });
}

const requestWriteHandle = async (
  chatDto: ChatDto,
  promptService: ScriptPromptService,
) => {
  const { text, data } = chatDto;
  const { data: intro } = await promptService.process(new ChatDto(), {
    to: 'role:members',
  });
  if (!intro.members?.length)
    return ChatDto.error(chatDto, 404, 'PM has no members to work with.');

  const members = await Promise.all(
    intro.members.map((m: any) =>
      promptService
        .process(new ChatDto(), { to: `@${m.name}#intro` })
        .then((v) => ({ nick: m.name, ...v.data })),
    ),
  );
  members.unshift({
    nick: 'customer', // TODO customer at parent?
    role: {
      goal: 'to propose business requirements, and check/accept the developed software.',
      professionals: ['Requirement Proposer', 'Software Stakeholder'],
    },
  });

  // write request过来，先判定kbs相关性
  chatDto = await promptService.process(chatDto, {
    to: 'llm',
    prompt: `given below team members:
${JSON.stringify(members)}
for the below request,
{
${text}
}
which members should change their content to fulfill the request,
please list in order in a json [empty] array without explanation:
[{changeTo: 'member nick', needContentFrom:["member nick"]}]`,
  });

  const rolePrompts = promptService.toJSON(chatDto.text, true);
};
