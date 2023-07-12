// import * as request from 'supertest';
import { sleep } from 'pactum';
import { eachLike, notNull } from 'pactum-matchers';
import { AppConstant } from '../../src/app.constants';
import { createActor } from './actors.e2e-spec';
import { afterEachFn, beforeEachFn } from './app-init.e2e';
import { chat2Actor } from './chats.e2e-spec';
import { afterAllSSE, beforeAllSSE } from './sse-init.e2e';

describe('RolesRole use case (e2e)', () => {
  beforeAll(beforeAllSSE);
  afterAll(afterAllSSE);
  beforeEach(beforeEachFn);
  afterEach(afterEachFn);

  it(`default entry response with recommended roles.`, async () => {
    const { id: actorId } = (
      await createActor({
        roleId: AppConstant.chatRoleId,
        hostId: AppConstant.chatRoleId + '-host',
        nick: 'chat-bot',
      })
    ).json;

    await sleep(1000);

    const testResponses = [
      'Carl Friedrich Gauss, a prolific German mathematician.',
      `[
        {
          professional: 'mathematician',
          goal: 'study of mathematics',
          'special skills':
            'knowledge of mathematical theories, proofs and calculations',
        },
        {
          professional: 'physicist',
          goal: 'study of physics and physical phenomena',
          'special skills':
            ' understanding of physical theories and natural laws',
        },
      ]`,
    ];

    const resp = await chat2Actor(actorId, '', true, {
      text: 'who is Gauss. reply about 10 words.',
      options: { testResponses },
    }).expectJsonMatch({
      statusCode: 0,
      text: testResponses.at(-1),
      data: eachLike({
        id: notNull(null),
        nick: notNull(null),
      }),
    });
    console.log(resp.json);
  });
});
