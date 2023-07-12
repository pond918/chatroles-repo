// import * as request from 'supertest';
import { expression } from 'pactum-matchers';
import { createActor } from './actors.e2e-spec';
import { afterEachFn, beforeEachFn } from './app-init.e2e';
import { chat2Actor } from './chats.e2e-spec';
import { afterAllSSE, beforeAllSSE } from './sse-init.e2e';

const pmRoleId = 'product-manager';
const pmHostId = pmRoleId + '-host';

describe('PM role use case (e2e)', () => {
  beforeAll(beforeAllSSE);
  afterAll(afterAllSSE);
  beforeEach(beforeEachFn);
  afterEach(afterEachFn);

  it(`create a pm, command story-break.`, async () => {
    const { id: actorId } = (
      await createActor({ roleId: pmRoleId, hostId: pmHostId, nick: 'pm' })
    ).json;

    const testResponses = [
      `[
  {
  "key":"US01",
  "userStory":"作为一个用户，我可以从web客户端访问chat-roles-repo服务以与预定义的chat-roles机器人进行对话。"
  },
  {
  "key":"US02",
  "userStory":"作为一个用户，我可以在web客户端左侧看到所有的会话列表，以便于选择并查看历史聊天记录。"
  },
  {
  "key":"US03",
  "userStory":"作为一个用户，我可以在web客户端中央的chatbox显示当前选中会话的聊天记录，以方便我进行交互。"
  },
  {
  "key":"US04",
  "userStory":"作为一个用户，我可以在web客户端右侧看到系统推荐的若干相关chat-roles机器人列表，以方便我继续探索聊天。"
  },
  {
  "key":"US05",
  "userStory":"作为一个用户，我可以在web客户端右侧点击相关机器人并开启一个新的会话，以便我开始与该机器人进行交互。"
  },
  {
  "key":"US06",
  "userStory":"作为一个用户，在与机器人的会话中，当我发送一条任务消息时，机器人将任务分解成多个子任务，发送给预定义的成员，并递归执行直到任务完成，返回结果消息。"
  },
  {
  "key":"US07",
  "userStory":"作为一个用户，在与机器人的会话中，我可以展开会话为树型节点，每个节点代表机器人的预定义子成员。"
  },
  {
  "key":"US08",
  "userStory":"作为一个用户，在与机器人的会话中，当我点击相应节点时，我可以看到该节点的会话内容，以方便我对任务进行跟进。"
  },
  {
  "key":"US09",
  "userStory":"作为一个用户，在与机器人的会话中，当我点击某个子成员的节点时，我可以与该成员直接对话，以帮助任务完成。"
  },
  {
  "key":"US10",
  "userStory":"作为一个用户，在与机器人的会话中，每一个会话都对应一个我提出的任务，具有明确的目标和技能要求。"
  },
  {
  "key":"US11",
  "userStory":"作为一个用户，在与机器人的会话中，每一个机器人都具有预设的目标和技能，并拥有一些预设的协作成员机器人来协同完成任务。"
  }
]`,
    ];

    // start free-style command
    let resp = (
      await chat2Actor(actorId, 'command-start', true, {
        options: {
          testResponses,
        },
      }).expectJsonMatch({
        statusCode: -1,
      })
    ).json;

    resp = (
      await chat2Actor(actorId, 'command-run', true, {
        data: {
          to: '@BA#version-upgrade',
          prompt: { key: '0.0.1', language: 'Chinese' },
        },
      }).expectJsonMatch({
        statusCode: 0,
      })
    ).json;

    resp = (
      await chat2Actor(actorId, 'command-run', true, {
        data: {
          to: '@BA#story-break',
          prompt:
            '制作一个web客户端，通过restAPI对接一个已有的后端服务"chat-roles-repo"，从而与后端大量预定义的chat-roles机器人对话。\
        客户端左侧纵向显示会话列表，中间是chatbox显示选中会话的聊天记录，右侧显示系统根据聊天内容推荐的若干相关chat-roles机器人列表。',
        },
      }).expectJsonMatch({
        statusCode: -1,
      })
    ).json;
    // end command in @BA#story-break
    resp = (
      await chat2Actor(actorId, 'command-end', true, {}).expectJsonMatch({
        statusCode: 0,
        data: expression('$V.length > 0'),
      })
    ).json;

    // designer command
    resp = (
      await chat2Actor(actorId, 'command-run', true, {
        data: { to: '@designer#generate-ui' },
      }).expectJsonMatch({
        statusCode: -1,
      })
    ).json;
    console.log(resp);

    resp = (
      await chat2Actor(actorId, 'command-end', true, {}).expectJsonMatch({
        statusCode: 0,
        data: expression('$V.length > 0'),
      })
    ).json;
  });
});
