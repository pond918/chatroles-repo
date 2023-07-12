// import * as request from 'supertest';
import { createActor } from './actors.e2e-spec';
import { afterEachFn, beforeEachFn } from './app-init.e2e';
import { chat2Actor } from './chats.e2e-spec';
import { afterAllSSE, beforeAllSSE } from './sse-init.e2e';

const kbkRoleId = 'knowledge-base-keeper';
const kbkHostId = kbkRoleId + '-host';

describe('KBKeeper role use case (e2e)', () => {
  beforeAll(beforeAllSSE);
  afterAll(afterAllSSE);
  beforeEach(beforeEachFn);
  afterEach(afterEachFn);

  it(`create a KBK, ask a question, yet kb empty.`, async () => {
    const { id: actorId } = (
      await createActor({ roleId: kbkRoleId, hostId: kbkHostId, nick: 'KBK' })
    ).json;

    const testResponses = [
      '{"language":"Chinese", "content":"What\'s the name of the man Helen loves"}',
    ];
    const resp = await chat2Actor(actorId, 'ask', true, {
      text: '海伦喜欢的人叫什么名字',
      options: { testResponses },
    }).expectJsonMatch({
      statusCode: 0,
      data: null,
      text: "What's the name of the man Helen loves",
    });
    console.log(resp.json);
  });

  it(`create a KBK, import content, then ask a question.`, async () => {
    const { id: actorId } = (
      await createActor({ roleId: kbkRoleId, hostId: kbkHostId, nick: 'KBK' })
    ).json;

    const { data: version } = (
      await chat2Actor(actorId, 'upgrade', true, { text: '0.2.0' })
    ).json;

    let resp = (
      await chat2Actor(actorId, 'import', true, {
        data: [
          {
            key: '#1',
            versionId: version.id,
            content:
              "Helen love's one of Tom's children. last Friday, Tom brings all his children: Bob and Alice to the concert.",
          },
        ],
      })
    ).json;

    const testResponses = [
      '{"language":"Chinese", "content":"What\'s the name of the man Helen loves"}',
      `1. Identify the relevant information in the content: 
      - Helen likes one of Tom's children.
      - Tom has two children named Bob and Alice.
      2. Determine if the information is enough to answer the question "What is the name of the man Helen likes?":
      - No, because the information provided only identifies Tom's children, but not which one Helen likes. It is possible that Helen likes Bob or Alice, but we can't be sure based on the given content alone.
      3. Suggest a more accurate question:
      - "Which of Tom's children does Helen love?"
      4. Reply with a JSON object:
      {
        "enough": false,
        "answer": "N/A",
        "question": "Which of Tom's children does Helen love?"
      }`,
    ];
    resp = await chat2Actor(actorId, 'ask', true, {
      text: '海伦喜欢的人叫什么名字',
      options: { testResponses },
    }).expectJsonMatch({
      statusCode: 0,
      data: null,
      text: "Which of Tom's children does Helen love?",
    });

    testResponses[1] = `{
        "enough": true,
        "answer": "Bob",
        "question": null
      }`;
    resp = await chat2Actor(actorId, 'ask', true, {
      text: '海伦喜欢的人叫什么名字',
      options: { testResponses },
    }).expectJsonMatch({
      statusCode: 0,
      data: true,
      text: 'Bob',
    });

    console.log(resp.json);
  });
});
