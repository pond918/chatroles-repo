import { PrismaClient } from '@prisma/client';
import { AppConstant } from '../src/app.constants';
import { seedAppDIY } from './appdiy/appdiy.seed';
import { seedKnowledgeBseKeeper } from './kb-keeper.seed';

// initialize Prisma Client
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  const sysUname = AppConstant.systemUsername;
  const sysUserDto = {
    id: sysUname,
    realm: 'local',
    username: sysUname,
    usernameLower: sysUname.toLowerCase(),
    resConfigs: [
      {
        type: 'llm',
        url: 'ClaudeBot',
        runtime: 'local',
      },
    ],
  };
  const systemUser = await prisma.user.upsert({
    where: { id: sysUname },
    update: sysUserDto,
    create: sysUserDto,
  });
  const sysActorDto = {
    id: sysUname,
    nick: sysUname,
    authToken: 'invalid_token001',
    roleId: AppConstant.emptyRoleId,
    ownerId: sysUname,
    parentId: sysUname,
    createdBy: sysUname,
  };
  const systemActor = await prisma.actor.upsert({
    where: { id: sysUname },
    update: sysActorDto,
    create: sysActorDto,
  });
  console.log({ systemActor, systemUser });

  const emptyRoleDto = {
    id: AppConstant.emptyRoleId,
    nick: 'EmptyRole',
    goal: 'Do nothing.',
    createdBy: sysUname,
    deleted: true,
    published: true,
  };
  const emptyRole = await prisma.role.upsert({
    where: { id: AppConstant.emptyRoleId },
    update: emptyRoleDto,
    create: emptyRoleDto,
  });

  // const bootstrapHost = await prisma.host.upsert({
  //   where: { id: AppConstant.emptyHostId },
  //   update: {},
  //   create: {
  //     id: AppConstant.emptyHostId,
  //     roleId: AppConstant.emptyRoleId,
  //     releasedNo: '1.0.0',
  //     createdBy: 'chatroles',
  //   },
  // });

  // roles-role /////////////////////////////
  const rolesRoleDto = {
    id: AppConstant.rolesRoleId,
    nick: 'RolesRole',
    goal: "To recommend suitable professional roles to help for user's question/topic/task.",
    skills: [
      'has knowledge of all roles on roles.chat site.',
      'ability to understand user question/topic/task.',
      'ability to match best professional roles for the task to user.',
    ],
    professionals: ['task assistant', 'experts recommender'],
    entries: [
      {}, // default null response
      {
        name: 'list',
        // this entry always don't save to chat history
        contextual: false,
        schema: `{
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "array",
          "items": {
              "$ref": "#/definitions/Item"
          },
          "definitions": {
              "Item": {
                  "type": "object",
                  "additionalProperties": false,
                  "properties": {
                    "avatar": {
                        "type": "string"
                    },
                    "goal": {
                        "type": "string"
                    },
                    "id": {
                        "type": "string"
                    },
                    "nick": {
                        "type": "string"
                    }
                  },
                  "required": [
                      "id",
                      "nick"
                  ],
                  "title": "Item"
              }
          }
      }`,
      },
    ],
    createdBy: sysUname,
    published: true,
  };
  const rolesRole = await prisma.role.upsert({
    where: { id: AppConstant.rolesRoleId },
    update: rolesRoleDto,
    create: rolesRoleDto,
  });

  // chat-role /////////////////////////////
  const chatRoleDto = {
    id: AppConstant.chatRoleId,
    nick: 'ChatBot',
    goal: 'Default role to chat with user in new conversation, with roles recommendations.',
    skills: [
      'to chat with user purposelessly.',
      'recommend roles during chatting.',
    ],
    createdBy: sysUname,
    published: true,
  };
  const chatRole = await prisma.role.upsert({
    where: { id: AppConstant.chatRoleId },
    update: chatRoleDto,
    create: chatRoleDto,
  });

  console.log({ emptyRole, rolesRole, chatRole });

  const rrHostId = AppConstant.rolesRoleId + '-host';
  const rolesRoleHostDto = {
    id: rrHostId,
    roleId: AppConstant.rolesRoleId.toString(),
    onEntries: [
      {}, // default null response
      {
        name: 'list',
        // this entry always don't save to chat history
        contextual: false,
        schema: `{
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "array",
          "items": {
              "$ref": "#/definitions/Item"
          },
          "definitions": {
              "Item": {
                  "type": "object",
                  "additionalProperties": false,
                  "properties": {
                    "avatar": {
                        "type": "string"
                    },
                    "goal": {
                        "type": "string"
                    },
                    "id": {
                        "type": "string"
                    },
                    "nick": {
                        "type": "string"
                    }
                  },
                  "required": [
                      "id",
                      "nick"
                  ],
                  "title": "Item"
              }
          }
      }`,
        handle: {
          to: 'llm',
          prompt:
            'which professionals(exclude translators) are qualified to help answering the following question?(reply in most strict json array in english:[{"professional":"val", "goal":"val", "special skills":"val"}]):\n<<req.text>>',
          responses: [
            { then: { to: 'json:array' } },
            {
              when: '<?!!req.data[.goal].professional?>',
              then: {
                to: 'iterator:#flat#<<id>>', // flat sub list; merge duplicate id objects
                responses: [
                  {
                    then: {
                      to: `restAPI:POST ${process.env.API_CR_VDB}/run/predict_1
                      { headers: { Authorization: 'Bearer <<env.API_CR_VDB_TOKEN>>', 'Content-type': 'application/json' }}`,
                      prompt: { data: ['<?req.data?>', 3] },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ],
    createdBy: sysUname,
    published: true,
    releasedNo: '0.1.0',
  };
  const rolesRoleHost = await prisma.host.upsert({
    where: { id: rrHostId },
    update: rolesRoleHostDto,
    create: rolesRoleHostDto,
  });

  const chatRoleHostId = AppConstant.chatRoleId + '-host';
  const chatRoleHostDto = {
    id: chatRoleHostId,
    roleId: AppConstant.chatRoleId.toString(),
    createdBy: sysUname,
    published: true,
    releasedNo: '1.0.0',
    members: [
      {
        name: 'RR',
        earlyCreate: false,
        hostId: rrHostId,
        roleId: AppConstant.rolesRoleId.toString(),
      },
    ],
    onCreate: { to: 'user', prompt: '' },
    onEntries: [
      {
        // default entry
        handle: {
          to: 'var:text',
          prompt: '<<req.text>>',
          responses: [
            { then: { to: '@RR#list' } },
            // FIXME: hints, stream, parallel
            { then: { to: 'llm', prompt: '<<text>>' } },
          ],
        },
      },
    ],
  };
  const chatRoleHost = await prisma.host.upsert({
    where: { id: chatRoleHostId },
    update: chatRoleHostDto,
    create: chatRoleHostDto,
  });
  console.log({ rolesRoleHost, chatRoleHost });

  const translatorRoleDto = {
    id: AppConstant.translatorRoleId,
    nick: 'Translator',
    goal: 'Translate the content. reply in json {language: "original", translated: "content" }',
    help: 'req.text to be translated; req.data to set target language if other than English.',
    skills: ['to identify the original language and translate the content.'],
    professionals: ['translator'],
    createdBy: sysUname,
    published: true,
  };
  const translatorRole = await prisma.role.upsert({
    where: { id: AppConstant.translatorRoleId },
    update: translatorRoleDto,
    create: translatorRoleDto,
  });
  const translatorHostId = AppConstant.translatorRoleId + '-host';
  const translatorHostDto = {
    id: translatorHostId,
    roleId: AppConstant.translatorRoleId,
    createdBy: sysUname,
    published: true,
    releasedNo: '0.1.0',
    onEntries: [
      {
        name: 'translate',
        contextual: false,
        handle: {
          to: 'llm',
          prompt:
            'please translate into <<(typeof req.data) == "string" ? req.data : "English">>:\n{\n<<req.text>>\n}\nreply a strict json object:{language: "original content language", translated: "content" }\nno any explanation',
          responses: [{ then: { to: 'json' } }],
        },
      },
    ],
  };
  const translatorHost = await prisma.host.upsert({
    where: { id: translatorHostId },
    update: translatorHostDto,
    create: translatorHostDto,
  });
  console.log({ translatorRole, translatorHost });
  ///////////////////////////////////////////
  seedAppDIY(prisma);
  seedKnowledgeBseKeeper(prisma);
}

// execute the main function
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // close Prisma Client at the end
    await prisma.$disconnect();
  });
