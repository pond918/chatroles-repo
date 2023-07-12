// import * as request from 'supertest';
import { expression } from 'pactum-matchers';
import { createActor } from './actors.e2e-spec';
import { afterEachFn, beforeEachFn } from './app-init.e2e';
import { chat2Actor } from './chats.e2e-spec';
import { afterAllSSE, beforeAllSSE } from './sse-init.e2e';

const designerRoleId = 'software-designer';
const designerHostId = designerRoleId + '-host';

describe('designer role use case (e2e)', () => {
  beforeAll(beforeAllSSE);
  afterAll(afterAllSSE);
  beforeEach(beforeEachFn);
  afterEach(afterEachFn);

  it(`create a designer, call generate-ui, expect 404, BA not found.`, async () => {
    const { id: actorId } = (
      await createActor({
        roleId: designerRoleId,
        hostId: designerHostId,
        nick: 'designer',
      })
    ).json;

    const resp = await chat2Actor(
      actorId,
      'generate-ui',
      true,
      {},
    ).expectJsonMatch({
      statusCode: 404,
      message: expression(`$V.indexOf('no member "BA"') >= 0`),
    });
    console.log(resp.json);
  });
});
