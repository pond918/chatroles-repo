// import * as request from 'supertest';
import { expression } from 'pactum-matchers';
import Spec from 'pactum/src/models/Spec';
import { createActor } from './actors.e2e-spec';
import { afterEachFn, beforeEachFn } from './app-init.e2e';
import { chat2Actor } from './chats.e2e-spec';
import { afterAllSSE, beforeAllSSE } from './sse-init.e2e';
import { generatePRD } from './ba-role.e2e-spec';

const designerRoleId = 'software-ui-designer';
const designerHostId = designerRoleId + '-host';

describe('designer role use case (e2e)', () => {
  beforeAll(beforeAllSSE);
  afterAll(afterAllSSE);
  beforeEach(beforeEachFn);
  afterEach(afterEachFn);

  it(`create a ui-designer, call generate ui, expect 404, BA not found.`, async () => {
    const [_, resp] = await generateUIComponents();
    const resp1 = await resp.expectJsonMatch({
      statusCode: 0,
      data: expression(`$V.length > 0`),
    });
    console.log(resp1.json);
  });
});

export const generateUIComponents = async (): Promise<[string, Spec]> => {
  const { id: rootActorId } = (
    await createActor({
      roleId: designerRoleId,
      hostId: designerHostId,
      nick: 'tskRoot',
    })
  ).json;
  await generatePRD(rootActorId);

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
      "key": "app",
      "level": "system",
      "type": "React Application",
      "description": "The overall React web application",
      "parent": null,
      "details": {
      "Framework": "React",
      "Router": "React Router",
      "State Management": "Redux"
      },
      "stories": []
      },
      {
      "key": "layout",
      "level": "module",
      "type": "Layout",
      "description": "The overall layout with sidebar and main area",
      "parent": "app",
      "details": {
      "Layout": "Horizontal layout with sidebar on left and main area on right"
      },
      "stories": ["US-01", "US-02", "US-03", "US-04"]
      },
      {
      "key": "sidebar",
      "level": "panel",
      "type": "Sidebar",
      "description": "The sidebar showing conversation list",
      "parent": "layout",
      "details": {
      "Content": "List of expandable conversation nodes"
      },
      "stories": ["US-01", "US-04"]
      },
      {
      "key": "chatbox",
      "level": "panel",
      "type": "Chatbox",
      "description": "The chatbox showing conversation messages",
      "parent": "layout",
      "details": {
      "Content": "Messages between user and selected conversation"
      },
      "stories": ["US-02", "US-03"]
      },
      {
      "key": "conversation-node",
      "level": "element",
      "type": "Expandable Node",
      "description": "Each conversation node in sidebar",
      "parent": "sidebar",
      "details": {
      "Expandable": "Can be expanded to show member tree",
      "Selectable": "Can be selected to show chat in chatbox"
      },
      "stories": ["US-01", "US-04"]
      },
      {
      "key": "send-message",
      "level": "element",
      "type": "Input Box",
      "description": "Input box to send messages",
      "parent": "chatbox",
      "details": {
      "Submit": "Hit enter or click button to send message"
      },
      "stories": ["US-03"]
      }
    ]`,
    `[
        {
        "key": "conversation-list",
        "level": "element",
        "type": "List",
        "description": "Shows list of conversations",
        "parent": "sidebar",
        "details": {
        "Orientation": "Vertical",
        "Content": "Conversation nodes"
        },
        "stories": ["US-01-01"]
        },
        {
        "key": "conversation-node",
        "level": "element",
        "type": "Node",
        "description": "Each node in conversation list",
        "parent": "conversation-list",
        "details": {
        "Expandable": "Can expand to show members",
        "Selectable": "Can select to show chat"
        },
        "stories": ["US-01-01", "US-01-02"]
        },
        {
        "key": "bot-avatar",
        "level": "element",
        "type": "Avatar",
        "description": "The avatar for the chatbot",
        "parent": "conversation-node",
        "details": {
        "Content": "Image/Icon representing chatbot"
        },
        "stories": ["US-01-02"]
        },
        {
        "key": "bot-name",
        "level": "element",
        "type": "Text",
        "description": "The name of the chatbot",
        "parent": "conversation-node",
        "details": {
        "Content": "Name of the chatbot"
        },
        "stories": ["US-01-02"]
        }
      ]`,
    `[
      {
      "key": "message-list",
      "level": "element",
      "type": "List",
      "description": "Shows list of messages",
      "parent": "chatbox",
      "details": {
      "Orientation": "Vertical",
      "Content": "Messages"
      },
      "stories": ["US-03-01", "US-03-03"]
      },
      {
      "key": "user-message",
      "level": "element",
      "type": "Message",
      "description": "User's message",
      "parent": "message-list",
      "details": {
      "Position": "Right aligned",
      "Content": "Text message from user"
      },
      "stories": ["US-03-02"]
      },
      {
      "key": "bot-message",
      "level": "element",
      "type": "Message",
      "description": "Bot's reply message",
      "parent": "message-list",
      "details": {
      "Position": "Left aligned",
      "Content": "Text message from bot"
      },
      "stories": ["US-03-03"]
      },
      {
      "key": "send-message",
      "level": "element",
      "type": "Input Box",
      "description": "Input box to type message",
      "parent": "chatbox",
      "details": {
      "Submit": "Send on enter or button click"
      },
      "stories": ["US-03-02"]
      }
    ]`,
  ];
  return [
    rootActorId,
    chat2Actor(actorId, 'generate', true, {
      options: {
        testResponses,
      },
    }),
  ];
};
