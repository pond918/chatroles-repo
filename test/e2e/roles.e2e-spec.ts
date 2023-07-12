// import * as request from 'supertest';
import * as pactum from 'pactum';
import { TestConstant } from '../test-constants';
import {
  afterAllFn,
  afterEachFn,
  beforeAllFn,
  beforeEachFn,
} from './app-init.e2e';
import { CreateRoleDto } from '../../src/roles/dto/create-role.dto';
import { eachLike } from 'pactum-matchers';

export const createRole = (roleDto?: Partial<CreateRoleDto>, auth = true) => {
  const dto = {
    nick: 'new-test-role',
    goal: 'for test',
    skills: ['for test skills 10 chars least.'],
    entries: [
      {
        name: 'entry1',
      },
    ],
    tags: ['tag1'],
    published: false,
    ...roleDto,
  };
  return pactum
    .spec()
    .post('/api/roles')
    .withBearerToken(auth ? TestConstant.authToken : 'invalid auth token')
    .withBody(dto)
    .expectStatus(auth ? 201 : 403);
};

describe('RolesController (e2e)', () => {
  beforeAll(beforeAllFn);
  afterAll(afterAllFn);
  beforeEach(beforeEachFn);
  afterEach(afterEachFn);

  const endpoint = '/api/roles';
  it(`${endpoint} (POST): create new role no auth, 403`, async () => {
    await createRole({}, false);
  });

  it(`${endpoint} (POST): create new role.`, async () => {
    await createRole();
  });

  it(`${endpoint} (POST): create published role.`, async () => {
    const resp = await createRole({ published: true }).expectJsonLike({
      published: true,
    });
    console.log(resp.json);
    await pactum.sleep(1000);
  });

  it(`${endpoint} (POST): update publish.`, async () => {
    const { id } = (await createRole()).json;

    const resp = await pactum
      .spec()
      .patch('/api/roles/' + id)
      .withBearerToken(TestConstant.authToken)
      .withBody({
        published: true,
        entries: [{ name: 'list', contextual: true }],
      })
      .expectStatus(200)
      .expectJsonMatch({
        published: true,
        entries: eachLike({ name: 'list', contextual: true }, { min: 1 }),
      });
    console.log(resp.json);
    await pactum.sleep(1000);
  });
});
