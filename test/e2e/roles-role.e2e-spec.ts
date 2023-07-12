// import * as request from 'supertest';
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

  it(`default entry null response.`, async () => {
    const { id: actorId } = (
      await createActor({
        roleId: AppConstant.rolesRoleId,
        hostId: AppConstant.rolesRoleId + '-host',
        nick: 'roles-role-actor',
      })
    ).json;

    const resp = (await chat2Actor(actorId, '', false, { text: 'hello' })).json;
    expect(resp).toBeNull();
  });

  it(`recommend professional roles when user sendPrompt.`, async () => {
    const { id: actorId } = (
      await createActor({
        roleId: AppConstant.rolesRoleId,
        hostId: AppConstant.rolesRoleId + '-host',
        nick: 'roles-role-actor',
      })
    ).json;

    const resp = await chat2Actor(actorId, 'list', false, {
      text: '高斯是干啥的?',
      options: {
        testResponses: [
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
        ],
      },
    }).expectJsonMatch({
      statusCode: 0,
      // text: includes('vectorStore'),
      data: eachLike(
        {
          id: notNull(null),
          nick: notNull(null),
        },
        { min: 0 },
      ),
    });
    console.log(resp.json);
  });
});
