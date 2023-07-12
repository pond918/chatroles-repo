// import * as request from 'supertest';
import * as pactum from 'pactum';
import {
  afterAllFn,
  afterEachFn,
  beforeAllFn,
  beforeEachFn,
} from './app-init.e2e';
import { AppConstant } from '../../src/app.constants';
import { TestConstant } from '../test-constants';

export const updateUser = () => {
  return pactum
    .spec()
    .patch('/api/users')
    .withBearerToken(TestConstant.authToken)
    .withBody({});
};

describe('UsersController (e2e)', () => {
  beforeAll(beforeAllFn);
  afterAll(afterAllFn);
  beforeEach(beforeEachFn);
  afterEach(afterEachFn);

  const newUsername = 'e2e-tesT-user-02';

  const endpoint = '/api/users';
  it(`${endpoint} (POST): register a new local config user`, async () => {
    return pactum
      .spec()
      .post(endpoint)
      .withJson({
        username: newUsername,
        resConfigs: [{ type: 'llm', url: 'ClaudeBot', runtime: 'local' }],
      })
      .expectStatus(201)
      .expectJsonLike({
        username: newUsername,
      });
  });

  it(`${endpoint} (POST): register a new user with conflict username`, async () => {
    return pactum
      .spec()
      .post(endpoint)
      .withJson({
        username: AppConstant.systemUsername,
        resConfigs: [{ type: 'llm', url: 'ClaudeBot', runtime: 'local' }],
      })
      .expectStatus(409);
  });

  it(`${endpoint} (POST): register a new user with invalid username`, async () => {
    return pactum
      .spec()
      .post(endpoint)
      .withJson({
        username: '_3245fgdg',
        resConfigs: [{ type: 'llm', url: 'ClaudeBot', runtime: 'local' }],
      })
      .expectStatus(400);
  });

  it(`${endpoint} (POST): register a new non-local config user`, async () => {
    return pactum
      .spec()
      .post(endpoint)
      .withJson({
        username: 'e2e-test-user-02',
        resConfigs: [
          {
            type: 'llm',
            runtime: 'server',
            url: 'ClaudeBot',
            props: { apiToken: 'ddf' },
          },
        ],
      })
      .expectStatus(400)
      .expectJsonLike({
        statusCode: 400,
      });
  });

  it(`${endpoint} (POST): update user`, async () => {
    const user = (await updateUser().expectStatus(200)).json;
    console.log(user);
  });
});
