// import * as request from 'supertest';
import * as pactum from 'pactum';
import { CreateActorDto } from '../../src/actors/dto/create-actor.dto';
import { CreateHostDto } from '../../src/hosts/dto/create-host.dto';
import { TestConstant } from '../test-constants';
import {
  afterAllFn,
  afterEachFn,
  beforeAllFn,
  beforeEachFn,
  prismaServiceForTest,
} from './app-init.e2e';
import { createNewHost } from './hosts.e2e-spec';

export const createNewActor = async (
  actorDto?: CreateActorDto,
  hostDto?: CreateHostDto,
) => {
  const { id: hostId, roleId } = await createNewHost(hostDto);

  // create actor
  return (
    await createActor({
      roleId,
      hostId,
      nick: 'test-user-empty-host',
      ...actorDto,
    })
  ).json;
};

export const createActor = (actorDto: CreateActorDto, auth = true) => {
  return pactum
    .spec()
    .post('/api/actors')
    .withBearerToken(auth ? TestConstant.authToken : 'invalid auth token')
    .withBody({
      nick: 'string',
      avatar: 'string',
      parentId: 'ChatRoles-system-user',
      ...actorDto,
    })
    .expectStatus(auth ? 201 : 403);
};

describe('ActorsController (e2e)', () => {
  beforeAll(beforeAllFn);
  afterAll(afterAllFn);
  beforeEach(beforeEachFn);
  afterEach(afterEachFn);

  describe('ActorsController (e2e)', () => {
    it('/actors/badId (GET), 404', () => {
      return pactum
        .spec()
        .get('/actors/badId')
        .withBearerToken(TestConstant.authToken)
        .expectStatus(404)
        .expectJsonLike({
          statusCode: 404,
        });
    });

    it('/actors/ (POST), create new non-root actor, expect creation ctx.', async () => {
      const { id: hostId, roleId } = await createNewHost();
      const resp = await createActor({
        roleId,
        hostId,
        nick: 'test-user-empty-host',
      }).expectStatus(201);

      const { id } = resp.json;
      const actor = await prismaServiceForTest.actor.findUnique({
        where: { id },
      });

      return expect(actor.ctxId).toBeGreaterThan(0);
    });
  });
});
