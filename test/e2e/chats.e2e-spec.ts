// import * as request from 'supertest';
import * as pactum from 'pactum';
import { lt, notEquals, regex } from 'pactum-matchers';
import { ChatDto } from '../../src/actors/chats/dto/chat-dto';
import { AppConstant } from '../../src/app.constants';
import { templite } from '../../src/infras/libs/templite';
import { TestConstant } from '../test-constants';
import { createActor, createNewActor } from './actors.e2e-spec';
import { afterEachFn, beforeEachFn } from './app-init.e2e';
import { createNewHost } from './hosts.e2e-spec';
import { afterAllSSE, beforeAllSSE } from './sse-init.e2e';

export const chat2Actor = (
  actorId: string,
  entry: string,
  contextual: boolean,
  chatDto: Partial<ChatDto>,
  statusCode = 200,
  auth = true,
  respJson = undefined,
) => {
  let url = `/api/actors/${actorId}/chat`;
  entry && (url += '/' + entry);
  return chat(url, contextual, chatDto, statusCode, auth, respJson);
};

const chat = (
  url: string,
  contextual: boolean,
  chatDto: Partial<ChatDto>,
  statusCode = 200,
  auth = true,
  respJson = undefined,
) => {
  let spec = pactum
    .spec()
    .withJson({
      options: {},
      ...chatDto,
    })
    .withBearerToken(auth ? TestConstant.authToken : 'invalid auth token');
  if (contextual) spec = spec.patch(url);
  else spec = spec.put(url);
  spec = spec.expectStatus(auth ? statusCode : 403);
  if (respJson !== undefined) spec = spec.expectJsonLike(respJson);
  return spec;
};

describe('ChatsController (e2e)', () => {
  beforeAll(beforeAllSSE);
  afterAll(afterAllSSE);
  beforeEach(beforeEachFn);
  afterEach(afterEachFn);

  const endpoint = '/api/actors/<<id>>/chat';
  let urlChatSys = templite(endpoint, {
    id: AppConstant.systemUsername,
  });
  it(`${endpoint} (PUT): chat no auth, 403`, () => {
    return chat(urlChatSys, false, {}, 403, false, { statusCode: 403 });
  });

  it(`${endpoint} (PUT): contextless chat to null role (no host), expect null response`, () => {
    return chat(urlChatSys, false, {}, 200, true, null);
  });

  it(`${endpoint} (PATCH): contextual chat to null role (no host), expect null response`, () => {
    return chat(urlChatSys, true, {}, 200, true, null);
  });

  const endpointEntry = '/api/actors/<<id>>/chat/<<entry>>';
  const urlEntryChatSys = templite(endpointEntry, {
    id: AppConstant.systemUsername,
    entry: 'invalidEntry',
  });
  it(`${endpointEntry} (PUT): contextless entry chat to null role (no host), expect 404`, () => {
    return chat(urlEntryChatSys, false, {}, 404, true);
  });

  it(`${endpointEntry} (PATCH): contextual entry chat to null role (no host), expect 404`, () => {
    return chat(urlEntryChatSys, true, {}, 404, true);
  });

  ///// interact with role default host ////

  it(`${endpoint} (PUT): contextless chat to default role (empty host), expect llm response.`, async () => {
    const { id: actorId } = await createNewActor();
    urlChatSys = templite(endpoint, { id: actorId });
    return chat(
      urlChatSys,
      true,
      { text: 'hello world.' },
      200,
      true,
    ).expectJsonLike({ statusCode: 0 });
  });

  it(`${endpoint} (PATCH): contextual chat to default role (empty host), expect contextual llm response.`, async () => {
    const { id: actorId } = await createNewActor();
    urlChatSys = templite(endpoint, { id: actorId });
    await chat(urlChatSys, true, { text: 'do you know Gauss.' }, 200, true);
    const resp = await chat(
      urlChatSys,
      true,
      {
        text: "what's his full name in English.",
        options: {
          testResponses: [
            'Carl Friedrich Gauss, a prolific German mathematician.',
          ],
        },
      },
      200,
      true,
    )
      .expectJsonMatch({ text: regex('Friedrich Gauss') })
      .expectJsonLike({ statusCode: 0 });
    return resp;
  });

  it(`${endpoint} (PUT): contextless chat to an actor member, expect llm response.`, async () => {
    // create role0 with empty host.
    const { id: hostId, roleId } = await createNewHost();

    // create role1 with member role0, and an entry to chat to the member.
    const memberName = 'my actor member';
    const entry = 'memberEntry';
    const { id: hostId1, roleId: roleId1 } = await createNewHost({
      roleId,
      members: [{ name: memberName, hostId, roleId, earlyCreate: true }],
      onEntries: [
        { name: entry, handle: { to: `@${memberName}`, prompt: '' } },
      ],
    });

    // create actor of role1
    const { id: actorId } = (
      await createActor({
        roleId: roleId1,
        hostId: hostId1,
        nick: 'test-user-empty-host',
      })
    ).json;

    // chat on the entry
    urlChatSys = templite(endpointEntry, { id: actorId, entry });
    return chat(
      urlChatSys,
      false,
      { text: 'hello world.' },
      200,
      true,
    ).expectJsonLike({ statusCode: 0 });
  });

  it(`${endpoint} (PATCH): contextual chat with maxQAs=1, expect no result.`, async () => {
    // create role0 with empty host.
    const { id: hostId, roleId } = await createNewHost();

    // create role1 with member role0, and an entry to chat to the member.
    const memberName = 'my actor member';
    const entry = 'memberEntry';
    const { id: hostId1, roleId: roleId1 } = await createNewHost({
      roleId,
      members: [{ name: memberName, hostId, roleId, earlyCreate: true }],
      onEntries: [
        { name: entry, handle: { to: `@${memberName}`, prompt: '' } },
      ],
    });

    // create actor of role1
    const { id: actorId } = (
      await createActor({
        roleId: roleId1,
        hostId: hostId1,
        nick: 'test-user-empty-host',
      })
    ).json;

    // chat on the entry
    urlChatSys = templite(endpointEntry, { id: actorId, entry });
    return chat(
      urlChatSys,
      true,
      { text: 'hello world.', options: { maxQAs: 1 } },
      200,
      true,
    ).expectJsonMatch({ options: { maxQAs: lt(0) }, statusCode: notEquals(0) });
  });
});
