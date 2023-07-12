// import * as request from 'supertest';
import { expression } from 'pactum-matchers';
import { createActor } from './actors.e2e-spec';
import { afterEachFn, beforeEachFn } from './app-init.e2e';
import { chat2Actor } from './chats.e2e-spec';
import { afterAllSSE, beforeAllSSE } from './sse-init.e2e';

const baRoleId = 'biz-requirement-analyst';
const baHostId = baRoleId + '-host';

describe('BA role use case (e2e)', () => {
  beforeAll(beforeAllSSE);
  afterAll(afterAllSSE);
  beforeEach(beforeEachFn);
  afterEach(afterEachFn);

  it(`create a BA, upgrade a invalid PRD version, expect 400.`, async () => {
    const { id: aId } = (
      await createActor({ roleId: baRoleId, hostId: baHostId, nick: 'BA' })
    ).json;

    let resp = await chat2Actor(aId, 'command-start', true, {});

    resp = await chat2Actor(aId, 'command-run', true, {
      data: { to: '@KBK#upgrade', prompt: '' },
    });

    resp = await chat2Actor(aId, 'command-end', true, {}).expectJsonMatch({
      statusCode: 400,
    });
    console.log(resp.json);
  });

  it(`create a BA, upgrade a PRD version.`, async () => {
    const { id: aId } = (
      await createActor({ roleId: baRoleId, hostId: baHostId, nick: 'BA' })
    ).json;

    let resp = await chat2Actor(aId, 'command-start', true, {});
    resp = await chat2Actor(aId, 'command-run', true, {
      data: { to: '@KBK#upgrade', prompt: '0.0.1' },
    });

    resp = await chat2Actor(aId, 'command-end', true, {}).expectJsonMatch({
      statusCode: 0,
      data: { key: '0.0.1' },
    });
    console.log(resp.json);
  });

  it(`create a BA, upgrade a PRD version with content.`, async () => {
    const { id: aId } = (
      await createActor({ roleId: baRoleId, hostId: baHostId, nick: 'BA' })
    ).json;

    let resp = await chat2Actor(aId, 'command-start', true, {});
    resp = await chat2Actor(aId, 'command-run', true, {
      data: {
        to: '@KBK#upgrade',
        prompt: { key: '0.0.1', description: 'first version' },
      },
    }).expectJsonMatch({
      statusCode: 0,
      data: { key: '0.0.1', content: { description: 'first version' } },
    });

    resp = await chat2Actor(aId, 'command-end', true, {}).expectJsonMatch({
      statusCode: 0,
      data: { key: '0.0.1' },
    });
    console.log(resp.json);
  });

  it(`create a BA, then give a requirement without PRD version. expect 400.`, async () => {
    const { id: actorId } = (
      await createActor({ roleId: baRoleId, hostId: baHostId, nick: 'BA' })
    ).json;

    const resp = (
      await chat2Actor(actorId, 'generate', true, {
        text: '需求',
      }).expectJsonMatch({
        statusCode: 400,
      })
    ).json;
    console.log(resp);
  });

  it(`create a BA, then give a requirement. generate PRD and give up.`, async () => {
    const { id: aId } = (
      await createActor({ roleId: baRoleId, hostId: baHostId, nick: 'BA' })
    ).json;

    const testResponses = [
      `[{"key":"US-01","summary":"显示会话列表","userStory": "作为用户，我希望在web客户端左侧能够看到一个纵向的会话列表，以便了解所有可用的会话。","acceptanceCriteria":["打开web客户端时，会话列表应该显示在左侧","每个会话对应一个chat-roles机器人"]},
      {"key":"US-02","summary":"展示选中会话节点的聊天记录","userStory": "作为用户，我希望在右侧主体的chatbox中能够实时显示选中会话节点的聊天记录，以便与节点机器人进行交流。","acceptanceCriteria":["选中会话节点后，chatbox应该显示相应的聊天记录","聊天记录应该是实时更新的"]},
      {"key":"US-03","summary":"与会话节点机器人对话","userStory": "作为用户，我希望能够与选中的会话节点机器人进行对话，以便传达任务或获取信息。","acceptanceCriteria":["选中会话节点后，可以在chatbox中与节点机器人对话"]},
      {"key":"US-04","summary":"展开会话节点成员树","userStory": "作为用户，我希望能够展开会话节点，以便查看该节点下的成员树，了解成员机器人的协作情况。","acceptanceCriteria":["会话节点应该有展开/折叠的功能","展开会话节点后，应显示该节点下的成员树"]}]`,
    ];

    // break the requirement
    let resp = (
      await chat2Actor(aId, 'generate', true, {
        text: '制作一个web客户端，通过restAPI对接一个已有的后端服务"chat-roles-repo"，从而与后端大量预定义的chat-roles机器人对话。\
客户端左侧纵向显示会话列表，每个会话对应一个chat-roles机器人，表示一个用户给机器人的一个任务。每个机器人内包含若干成员机器人互相协作。会话节点可以展开为成员树，任意选中一个节点，可与节点机器人对话。\
右侧主体是chatbox，显示选中会话节点的聊天记录，并可以实时与节点机器人对话。',
        data: { versionKey: '1.0.0', language: 'Chinese' },
        options: {
          testResponses,
        },
      })
    ).json;

    // end the cmd session, after adjustment
    resp = (
      await chat2Actor(aId, 'command-end', true, {
        statusCode: 1,
      }).expectJsonMatch({
        statusCode: 1,
        text: testResponses[0],
      })
    ).json;

    console.log(resp);
  });

  it(`create a BA, then give a requirement. generate PRD result.`, async () => {
    const { id: aId } = (
      await createActor({ roleId: baRoleId, hostId: baHostId, nick: 'BA' })
    ).json;

    const testResponses = [
      `[{"key":"US-01","summary":"显示会话列表","userStory": "作为用户，我希望在web客户端左侧能够看到一个纵向的会话列表，以便了解所有可用的会话。","acceptanceCriteria":["打开web客户端时，会话列表应该显示在左侧","每个会话对应一个chat-roles机器人"]},
      {"key":"US-02","summary":"展示选中会话节点的聊天记录","userStory": "作为用户，我希望在右侧主体的chatbox中能够实时显示选中会话节点的聊天记录，以便与节点机器人进行交流。","acceptanceCriteria":["选中会话节点后，chatbox应该显示相应的聊天记录","聊天记录应该是实时更新的"]},
      {"key":"US-03","summary":"与会话节点机器人对话","userStory": "作为用户，我希望能够与选中的会话节点机器人进行对话，以便传达任务或获取信息。","acceptanceCriteria":["选中会话节点后，可以在chatbox中与节点机器人对话"]},
      {"key":"US-04","summary":"展开会话节点成员树","userStory": "作为用户，我希望能够展开会话节点，以便查看该节点下的成员树，了解成员机器人的协作情况。","acceptanceCriteria":["会话节点应该有展开/折叠的功能","展开会话节点后，应显示该节点下的成员树"]}]`,
    ];

    // break the requirement
    let resp = (
      await chat2Actor(aId, 'generate', true, {
        text: '制作一个web客户端，通过restAPI对接一个已有的后端服务"chat-roles-repo"，从而与后端大量预定义的chat-roles机器人对话。\
客户端左侧纵向显示会话列表，每个会话对应一个chat-roles机器人，表示一个用户给机器人的一个任务。每个机器人内包含若干成员机器人互相协作。会话节点可以展开为成员树，任意选中一个节点，可与节点机器人对话。\
右侧主体是chatbox，显示选中会话节点的聊天记录，并可以实时与节点机器人对话。',
        data: { versionKey: '1.0.0', language: 'Chinese' },
        options: {
          testResponses,
        },
      })
    ).json;

    // confirm to save
    resp = (
      await chat2Actor(aId, 'command-end', true, {}).expectJsonMatch({
        statusCode: 0,
        data: expression(`$V.length == 4`),
      })
    ).json;

    // confirm to end
    resp = (
      await chat2Actor(aId, 'command-end', true, { text: '' }).expectJsonMatch({
        statusCode: 0,
      })
    ).json;
    console.log(resp);
  });

  it(`create a BA, then give a requirement. generate PRD result, and continue break.`, async () => {
    const testResponses = [
      `[{"key":"US-01","summary":"显示会话列表","userStory": "作为用户，我希望在web客户端左侧能够看到一个纵向的会话列表，以便了解所有可用的会话。","acceptanceCriteria":["打开web客户端时，会话列表应该显示在左侧","每个会话对应一个chat-roles机器人"]},
      {"key":"US-02","summary":"展示选中会话节点的聊天记录","userStory": "作为用户，我希望在右侧主体的chatbox中能够实时显示选中会话节点的聊天记录，以便与节点机器人进行交流。","acceptanceCriteria":["选中会话节点后，chatbox应该显示相应的聊天记录","聊天记录应该是实时更新的"]},
      {"key":"US-03","summary":"与会话节点机器人对话","userStory": "作为用户，我希望能够与选中的会话节点机器人进行对话，以便传达任务或获取信息。","acceptanceCriteria":["选中会话节点后，可以在chatbox中与节点机器人对话"]},
      {"key":"US-04","summary":"展开会话节点成员树","userStory": "作为用户，我希望能够展开会话节点，以便查看该节点下的成员树，了解成员机器人的协作情况。","acceptanceCriteria":["会话节点应该有展开/折叠的功能","展开会话节点后，应显示该节点下的成员树"]}]`,
      `[{"key":"US-01-01","summary":"查看会话列表","userStory":"作为用户，我希望能够查看纵向排列的会话列表，以便了解所有可用的会话。","acceptanceCriteria":["打开web客户端时，会话列表应该显示在左侧"]},{"key":"US-01-02","summary":"会话与chat-roles机器人对应","userStory":"作为用户，我希望每个会话能够对应一个chat-roles机器人，以表示一个用户给机器人的一个任务。","acceptanceCriteria":["每个会话都有一个对应的chat-roles机器人"]}]`,
      `[
        {
          "key": "US-03-01",
          "summary": "选择会话节点",
          "userStory": "作为用户，我希望能够在会话列表中选择一个节点，以便与该节点的机器人进行对话。",
          "acceptanceCriteria": ["在会话列表中点击一个会话节点，chatbox应该显示该节点的聊天记录"]
        },
        {
          "key": "US-03-02",
          "summary": "发送消息给节点机器人",
          "userStory": "作为用户，我希望能够在chatbox中输入消息并发送给选中的会话节点机器人，以便与其进行对话。",
          "acceptanceCriteria": ["在chatbox中输入消息内容，并点击发送按钮后，消息应该被发送给选中的会话节点机器人"]
        },
        {
          "key": "US-03-03",
          "summary": "接收节点机器人的响应消息",
          "userStory": "作为用户，我希望能够在chatbox中实时接收选中会话节点机器人的响应消息，以便进行交流。",
          "acceptanceCriteria": ["chatbox应该实时显示选中会话节点机器人的响应消息"]
        }
      ]`,
    ];
    await generatePRD(null, testResponses);
  });

  it(`create a BA, test default entry forward named entry.`, async () => {
    const { id: actorId } = (
      await createActor({ roleId: baRoleId, hostId: baHostId, nick: 'BA' })
    ).json;

    let resp = await chat2Actor(actorId, 'version-upgrade', true, {
      text: '0.0.1',
    }).expectJsonMatch({
      statusCode: 0,
      data: { key: '0.0.1' },
    });

    const testResponses = [
      '{"name":"story-break"}',
      `[{"key":"US-01", "userStory": "作为一个用户，我希望能够浏览所有会话的列表，以便快速选择想要交互的机器人。", "summary":"浏览会话列表"},"acceptanceCriteria": ["展示所有可用的会话机器人列表。","点击一个会话节点时，正确地更新右侧聊天记录和chatbox。"]},
      {"key":"US-02", "userStory": "作为一个用户，我希望能够与选定的机器人进行实时对话，以便有效完成任务。", "summary":"与机器人对话"},"acceptanceCriteria": ["在chatbox中显示当前与机器人的历史记录和实时消息。","能够发送文本消息给节点机器人并接收回复。"]},
      {"key":"US-03", "userStory": "作为一个用户，我希望能够查看每个机器人内包含的成员机器人，以便了解它们的关联和协作方式。", "summary":"查看成员机器人"},"acceptanceCriteria": ["将会话节点展开为成员树，并显示所有成员机器人。","正确显示成员机器人之间的关联。"]}]`,
    ];
    resp = await chat2Actor(actorId, '', true, {
      text: '提个新需求：手机号直接登录',
      options: { testResponses },
    }).expectJsonMatch({
      statusCode: -1,
    });

    // end the cmd session, after adjustment
    resp = (
      await chat2Actor(actorId, 'command-end', true, {}).expectJsonMatch({
        statusCode: 0,
        data: expression(`$V.length == 3`),
      })
    ).json;

    console.log(resp);
  });
});
export async function generatePRD(parentId?: string, testResponses?: string[]) {
  const { id: aId } = (
    await createActor({
      roleId: baRoleId,
      hostId: baHostId,
      nick: 'BA',
      parentId,
    })
  ).json;

  // break the requirement
  let resp = (
    await chat2Actor(aId, 'generate', true, {
      text: '制作一个web客户端，通过restAPI对接一个已有的后端服务"chat-roles-repo"，从而与后端大量预定义的chat-roles机器人对话。\
客户端左侧纵向显示会话列表，每个会话对应一个chat-roles机器人，表示一个用户给机器人的一个任务。每个机器人内包含若干成员机器人互相协作。会话节点可以展开为成员树，任意选中一个节点，可与节点机器人对话。\
右侧主体是chatbox，显示选中会话节点的聊天记录，并可以实时与节点机器人对话。',
      data: { versionKey: '1.0.0', language: 'Chinese' },
      options: {
        testResponses,
      },
    }).expectJsonMatch({ statusCode: -1 })
  ).json;

  // confirm to save
  resp = (
    await chat2Actor(aId, 'command-end', true, {}).expectJsonMatch({
      statusCode: 0,
      data: expression(`$V.length > 0`),
    })
  ).json;

  // confirm to split new
  resp = (
    await chat2Actor(aId, 'command-end', true, {
      text: 'US-01',
    }).expectJsonMatch({
      statusCode: 0,
    })
  ).json;

  // confirm to save
  resp = (
    await chat2Actor(aId, 'command-end', true, {}).expectJsonMatch({
      statusCode: 0,
      data: expression(`$V.length > 0`),
    })
  ).json;

  // confirm to split new
  resp = (
    await chat2Actor(aId, 'command-end', true, {
      text: 'US-03',
    }).expectJsonMatch({
      statusCode: 0,
    })
  ).json;

  // confirm to save
  resp = (
    await chat2Actor(aId, 'command-end', true, {}).expectJsonMatch({
      statusCode: 0,
      data: expression(`$V.length > 0`),
    })
  ).json;

  // confirm to end
  resp = (
    await chat2Actor(aId, 'command-end', true, { text: '' }).expectJsonMatch({
      statusCode: 0,
    })
  ).json;

  console.log(resp);
  return aId;
}
