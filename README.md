<p align="center">Chat with AI Roles, they'll get things done.</p>

<p align="center">
<a href="#license"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://github.com/pond918/chatroles-repo/actions"><img src="https://github.com/pond918/chatroles-repo/workflows/ci/badge.svg"/></a>
<!-- <a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a> -->
<a href="#contributors"><img src="https://img.shields.io/github/all-contributors/pond918/chatroles-repo?color=ee8449&style=flat-square"></img></a>
<img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" height="20px">

</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## What

The [ChatRoles-repo](https://roles.chat) platform is a place to gather various user-defined llm role-bots (called `chatroles`), to leverage power of the SOTA large language models(LLM) like ChatGPT, and many other multimodal deep learning models.

You may assign different tasks to specific chatroles, who will collaborate with other roles in repo, and finally accomplish the goal.

You may also define your own `chatroles`, and easily integrate them into your own systems through the [chat-actors](https://repo-sandbox.roles.chat/docs/api#/chat-APIs) APIs.

## Why

A question is a task. While a big task may involve many questions.

Usually we firstly decompose a task into sub-tasks, and forward them to professionals to handle in organization.

If we formalize these processes into `chatroles` repo, and let them cooperate as expected,

then we may just ask a BIG question/task, let `chatroles` to process it as thousands of internal QAs, then we get the final BIG result.

This is a bit like [Auto-GPT](https://github.com/Significant-Gravitas/Auto-GPT), while the auto process is formalized as `chatroles` for reuse.

## How

You may define your own `chatrole`, or just chat to existing ones in repo.

### Role definition

`chatroles` is structured as below,

![chatrole and host definition](docs/imgs/role-host.svg)

a chatrole definition consists of:

- [chatrole](https://repo-sandbox.roles.chat/docs/api#/chat-roles)
  the professional role with specific task goal
- [host](https://repo-sandbox.roles.chat/docs/api#/chat-roles%20programming)
  the programmed prompts of the role, invoking tools and members
- toolbox
  platform offers several tools, e.g. llm, restAPI, vectorDB...
- members
  each role has several `chatroles` members as a team

There are some predefined `chatroles`, please read more [here](https://roles.chat/blog/2023/introduction-to-chat-roles-repo/).

### Chat to roles

To [chat](https://repo-sandbox.roles.chat/docs/api#/chat-APIs) with a role, you need to [instantiate](https://repo-sandbox.roles.chat/docs/api#/chat-actors) an `actor` from the role. Then send a [ChatDto](https://repo-sandbox.roles.chat/docs/api#/%23model-ChatDto:~:text=ChatOptions-,ChatDto,-ResponseRule) to an actor entry.

### User authentication and resources

You need to registered to the repo to invoke all APIs:

1. [OAuth](https://repo-sandbox.roles.chat/docs/api#/user-auth/OAuthController_oauthStart) with your github account
2. [Config](https://repo-sandbox.roles.chat/docs/api#/user-auth/UsersController_updateUser) your own LLM access-tokens
   Currently, we offer 3k ChatGPT tokens to test for free each day.
3. define or chat with `chatroles`

## For developers

If you want to deploy `chatrole-repo` locally, please follow instructions below.

### Installation

git clone, then:

```bash
pnpm install
```

### Running the app

copy `.env.dev` to `.env`

#### install postgres with pgvector

```shell
docker run -dt -e POSTGRES_PASSWORD=postgres -p 5432:5432 --name postgres-pgvector ankane/pgvector
```

> see https://github.com/pgvector/pgvector

#### Generate schema/db seed/entity code

```bash
pnpm run generate  # generate Prisma Client, dto/entity
pnpm run seed  # execute seed.ts, generate db seed data
npx prisma migrate dev # all in one: generate db migrations file; apply db schema change; generate Prisma Client, dto/entity, db seed
# pnpm run migrate # to apply migrate deployment
```

#### Start app

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

### Testing

```bash
# unit tests
$ npm run test

# TDD: runs specific e2e test cases
$ npm run test:e2e -- --watch --coverage --testPathPattern 'actors' --testNamePattern actors 

# e2e test with sql query logs, loglevel=[0,6], from silent to verbose
$ loglevel=1 npm run test:e2e [...]

# e2e tests all
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

### Misc

#### JWT Bearer Auth

access token in header. auto refreshed in `JWT_REFRESH_EXPIRES_IN` duration. new token is set into the response header.

#### Local resource sse(server sent events)

repo server may send event logs or local llm requests to client, client may handle these events as flows,

```javascript
const evtSource = new EventSource("//repo.roles.chat/api/events/subscribe", {
  withCredentials: true,
});

evtSource.addEventListener("llm", (event) => {
  const { actorId, payload } = JSON.parse(event.data);
  // handle event.
  // $.post(`//repo.roles.chat/api/events/respond/${event.id}`)
});
```

## TODOs

- [ ]  deprecate singleton
- [ ]  event logging &  error handling.
- [ ]  private role?
- [ ]  scopedStorage tx bind to db
- [ ]  bug: auth not changed when internal chat, only correspond to request jwt,
- [ ]  support for maxQAs counting, negative maxQAs
- [ ]  support `escape` for templite, e.g. '{ "query": "{ Get { ChatRoles(limit: 2; search: <<escape(req.data)>>) } }" }'
- [ ]  test 2 simultaneous long conversations, they should be irrelevant in diff scopes with same var name,.
- [ ]  message response: content/hints/ops,

## Welcome PRs

### Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

## License

chatroles-repo is [MIT licensed](LICENSE).
