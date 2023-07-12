// import * as request from 'supertest';
import * as pactum from 'pactum';
import { CreateHostDto } from '../../src/hosts/dto/create-host.dto';
import { TestConstant } from '../test-constants';
import {
  afterAllFn,
  afterEachFn,
  beforeAllFn,
  beforeEachFn,
} from './app-init.e2e';
import { createRole } from './roles.e2e-spec';

export const createNewHost = async (
  hostDto?: CreateHostDto,
): Promise<CreateHostDto> => {
  // create role
  const { id: roleId } = (await createRole({ published: true })).json;
  // create an empty host
  return (await _createHost({ roleId, published: true, ...hostDto })).json;
};

const _createHost = (hostDto: CreateHostDto, auth = true) => {
  return pactum
    .spec()
    .post('/api/hosts')
    .withBearerToken(auth ? TestConstant.authToken : 'invalid auth token')
    .withBody({
      published: false,
      releasedNo: 'string',
      ...hostDto,
    })
    .expectStatus(auth ? 201 : 403);
};

describe('HostsController (e2e)', () => {
  beforeAll(beforeAllFn);
  afterAll(afterAllFn);
  beforeEach(beforeEachFn);
  afterEach(afterEachFn);

  it('/api/hosts (POST): create new empty host.', async () => {
    await createNewHost();
  });
});
