// import * as request from 'supertest';
import { expression } from 'pactum-matchers';
import { createActor } from './actors.e2e-spec';
import { afterEachFn, beforeEachFn } from './app-init.e2e';
import { chat2Actor } from './chats.e2e-spec';
import { generateUIComponents } from './designer-role.e2e-spec';
import { afterAllSSE, beforeAllSSE } from './sse-init.e2e';

const architectRoleId = 'software-ui-architect';
const architectHostId = architectRoleId + '-host';

describe('ui architect role use case (e2e)', () => {
  beforeAll(beforeAllSSE);
  afterAll(afterAllSSE);
  beforeEach(beforeEachFn);
  afterEach(afterEachFn);

  it(`create a ui-architect, choose framework.`, async () => {
    const [rootActorId, resp0] = await generateUIComponents();
    await resp0;
    const { id: actorId } = (
      await createActor({
        roleId: architectRoleId,
        hostId: architectHostId,
        parentId: rootActorId,
        nick: 'ui-architect',
      })
    ).json;

    const testResponses = [
      `Based on the requirements of building a web client with a chat interface that connects to a backend chatbot service, I would recommend using React as the UI framework.
React is well-suited for building interactive UIs and managing complex state. Key reasons why React would be a good choice:
Declarative programming model makes building complex UIs easier to reason about. The component model promotes reusability.
Virtual DOM and reactive updates make building chat interfaces very performant compared to traditional MVC frameworks.
Large ecosystem of React libraries like react-router for routing, Redux for state management, etc.
Here is a suggested project setup:
{
  "framework": "React",
  "project-name": "chatbots-web-client", 
  "project-init-command": "npx create-react-app chatbots-web-client"
}
The project can be initialized using Create React App which provides a nice project scaffolding and build setup out of the box.

Let me know if you need any other details!`,
    ];
    const resp = await chat2Actor(actorId, 'choose-framework', true, {
      options: {
        testResponses,
      },
    }).expectJsonMatch({
      statusCode: 0,
    });
    console.log(resp.json);
  });
});
