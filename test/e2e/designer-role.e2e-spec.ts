// import * as request from 'supertest';
import { expression } from 'pactum-matchers';
import { createActor } from './actors.e2e-spec';
import { afterEachFn, beforeEachFn } from './app-init.e2e';
import { chat2Actor } from './chats.e2e-spec';
import { afterAllSSE, beforeAllSSE } from './sse-init.e2e';
import { generateBDDCases } from './bdd-role.e2e-spec';

const designerRoleId = 'software-ui-designer';
const designerHostId = designerRoleId + '-host';

describe('designer role use case (e2e)', () => {
  beforeAll(beforeAllSSE);
  afterAll(afterAllSSE);
  beforeEach(beforeEachFn);
  afterEach(afterEachFn);

  it(`create a ui-designer, call generate ui, expect 404, BA not found.`, async () => {
    const [rootActorId, _] = await generateBDDCases();
    const { id: actorId } = (
      await createActor({
        roleId: designerRoleId,
        hostId: designerHostId,
        parentId: rootActorId,
        nick: 'ui-designer',
      })
    ).json;

    const testResponses = [
      `[
      {
        "key": "list-view",
        "type": "Side Nav",
        "description": "Displays a vertical list of conversations",
        "parent": null,
        "stories": [
          "US-01"
        ]
      },
      {
        "key": "conversation-node",
        "type": "Tree View Node",
        "description": "Displays a conversation node with expand/collapse functionality",
        "parent": "list-view",
        "stories": [
          "US-01",
          "US-02",
          "US-03",
          "US-04"
        ]
      },
      {
        "key": "chat-box",
        "type": "Chat Interface",
        "description": "Displays chat history and allows users to message the selected conversation node's chat bot",
        "parent": null,
        "stories": [
          "US-02",
          "US-03"
        ]
      }
    ]`,
      `[
      {
      "key": "list-view",
      "type": "Side Nav",
      "description": "Displays a vertical list of conversations with their associated chat-roles bot",
      "parent": null,
      "stories": [
      "US-01-01",
      "US-01-02"
      ]
      },
      {
      "key": "conversation-node",
      "type": "Tree View Node",
      "description": "Displays a conversation node with expand/collapse functionality, allowing user to select and chat with the associated chat-roles bot",
      "parent": "list-view",
      "stories": [
      "US-01-01",
      "US-01-02"
      ]
      }
      ]`,
      `[
        {
        "key": "conversation-node",
        "type": "Tree View Node",
        "description": "Displays a conversation node with expand/collapse functionality and allows user to select the associated chat-roles bot",
        "parent": "list-view",
        "stories": [
        "US-03-01",
        "US-03-02",
        "US-03-03"
        ]
        },
        {
        "key": "chat-box",
        "type": "Chat Interface",
        "description": "Displays chat history and allows users to message the selected conversation node's chat-roles bot and receive real-time responses",
        "parent": null,
        "stories": [
        "US-03-01",
        "US-03-02",
        "US-03-03"
        ]
        }
        ]`,
      `[
          {
          "key": "conversation-node",
          "type": "Tree View Node",
          "description": "Displays a conversation node with expand/collapse functionality, allowing user to select and chat with the associated chat-roles bot.",
          "parent": "list-view",
          "details": "Each conversation node should have an event listener to trigger the selection of the corresponding chat-roles bot. When the node is selected, the corresponding chat history should be displayed in the chat box.",
          "stories": [
          "US-03-01",
          "US-03-02",
          "US-03-03"
          ]
          },
          {
          "key": "chat-box",
          "type": "Chat Interface",
          "description": "Displays chat history and allows users to message the selected conversation node's chat bot.",
          "parent": null,
          "details": "The chat box should allow users to type and send messages to the selected chat-roles bot. The chat history of the selected conversation node should be displayed in the chat box, and new messages from the bot should be displayed in real-time as they arrive.",
          "stories": [
          "US-03-01",
          "US-03-02",
          "US-03-03"
          ]
          }
          ]`,
    ];
    const resp = await chat2Actor(actorId, 'generate', true, {
      options: {
        testResponses,
      },
    }).expectJsonMatch({
      statusCode: 0,
      data: expression(`$V.length > 0`),
    });
    console.log(resp.json);
  });
});
