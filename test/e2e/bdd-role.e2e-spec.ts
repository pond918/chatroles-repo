// import * as request from 'supertest';
import { nanoid } from 'nanoid';
import { eachLike, expression, notNull } from 'pactum-matchers';
import Spec from 'pactum/src/models/Spec';
import { PrismaTransactionScope } from '../../src/infras/repos/tx/prisma-tx-scope';
import { createActor } from './actors.e2e-spec';
import { afterEachFn, beforeEachFn, testApp } from './app-init.e2e';
import { generatePRD } from './ba-role.e2e-spec';
import { chat2Actor } from './chats.e2e-spec';
import { afterAllSSE, beforeAllSSE } from './sse-init.e2e';
import { updateSystemUser } from './users.e2e-spec';

const bddRoleId = 'bdd-analyst';
const bddHostId = bddRoleId + '-host';

describe('BDD role use case (e2e)', () => {
  beforeAll(beforeAllSSE);
  afterAll(afterAllSSE);
  beforeEach(beforeEachFn);
  afterEach(afterEachFn);

  it(`create a BDD, generate BDD cases.`, async () => {
    const [_, spec] = await generateBDDCases();
    const resp = (
      await spec.expectJsonMatch({
        statusCode: 0,
        data: eachLike(
          {
            id: notNull(null),
            domain: expression(`$V == 'BDD'`),
            parentId: notNull(null),
            content: expression(`$V.indexOf("Scenario:") == 0`),
          },
          { min: 1 },
        ),
      })
    ).json;
    console.log(resp);
  });

  it(`create a BDD, gen BDD cases with real platform no quota llms.`, async () => {
    const user = (await updateSystemUser()).json; // platform llm resource reload
    console.log(user);

    const baRoleId = 'biz-requirement-analyst';
    const baHostId = baRoleId + '-host';
    const { id: aId } = (
      await createActor({
        roleId: baRoleId,
        hostId: baHostId,
        nick: 'BA',
      })
    ).json;

    const quota = await initQuota(user.id, 0);
    console.log(quota);

    // break the requirement
    const resp = (
      await chat2Actor(aId, 'generate', true, {
        text: 'test',
        data: { versionKey: '1.0.0', language: 'Chinese' },
      }).expectJsonMatch({ statusCode: 402 })
    ).json;

    console.log(resp);
  });

  it(`create a BDD, gen BDD cases with real platform llms.`, async () => {
    // update system-user to use real platform llm resource
    const user = (await updateSystemUser()).json; // platform llm resource reload
    console.log(user);

    // init quota
    const quota = await initQuota(user.id, 3000, [86400000, 3000]);
    console.log(quota);

    await generateBDDCases();
  });
});

async function initQuota(userId: string, quota = 1000, reset?: number[]) {
  const transactionScope = testApp.get(PrismaTransactionScope);
  const q = await transactionScope.run(async (prisma) =>
    prisma.quota.create({
      data: {
        id: nanoid(),
        userId,
        runtime: 'platform',
        type: 'llm',
        name: 'azureOpenAIApi',
        quota,
        invalidAt: new Date('2023-07-09'),
        reset,
      },
    }),
  );
  return q;
}

export async function generateBDDCases(): Promise<[string, Spec]> {
  // need a parent actor, to put BA & BDD in the same task context.
  const { id: rootActorId } = (
    await createActor({ roleId: bddRoleId, hostId: bddHostId, nick: 'tskRoot' })
  ).json;

  // FIXME BDD is generated based on PRD/UI/API designs

  // generate stories first
  await generatePRD(rootActorId);

  // create an actor in new ctx,
  const { id: aId } = (
    await createActor({
      roleId: bddRoleId,
      hostId: bddHostId,
      nick: 'BDD',
      parentId: rootActorId,
    })
  ).json;

  const testResponses = [
    `\`\`\`
Feature: Chat-roles web client

As a user
I want to use a web client to chat with chat-roles robots
So that I can complete tasks using the predefined chat-roles robots

Scenario: Display session list
  Given that I open the web client
  Then the session list should be displayed on the left side
  And each session corresponds to a chat-roles robot

Scenario: View session list
  Given that the web client is open
  When I view the session list
  Then the vertical session list should be displayed on the left side
\`\`\`
Note: Additional scenarios could be generated based on other user stories in the chain.`,
    `\`\`\`gherkin
Feature: Web Client for Chat-Roles

Scenario: Display conversation list
  Given that I open the web client
  Then I should see the conversation list displayed on the left-hand side
  And each conversation in the list should correspond to a chat-roles bot

Scenario: Correspond conversation to chat-roles bot
  Given a conversation is selected
  Then I should see the chat history for the corresponding chat-roles bot displayed on the right-hand side
  And all conversations should be mapped to a specific chat-roles bot

Scenario: Expand and collapse conversation nodes
  Given any conversation node in the list has sub-nodes
  When I click on the node to expand it
  Then I should see the sub-nodes for that conversation node displayed under the parent node
  And when I click on the node again to collapse it
  Then I should not see the sub-nodes displayed anymore

Scenario: Start a conversation with a selected node
  Given a conversation node in the list is selected
  When I enter a message in the chatbox and hit send
  Then I should see my message displayed in the conversation history on the right-hand side
  And I should see the response from the corresponding chat-roles bot

Scenario: Display conversation history
  Given a conversation node in the list is selected
  Then I should see the conversation history displayed on the right-hand side
\`\`\``,
    `\`\`\`
Feature: Chat-Roles Client

Scenario: User can view chat history of selected session node
  Given the user has opened the Chat-Roles client
  And the user is logged in and connected to the "chat-roles-repo" backend service
  When the user selects a session node from the session list on the left side of the client
  Then the chatbox on the right side of the client should display the chat history for the selected session node
  And the chat history should be updated in real-time as new messages are sent and received

Scenario: User can communicate with the selected session node's machine members
  Given the user has opened the Chat-Roles client
  And the user is logged in and connected to the "chat-roles-repo" backend service
  When the user selects a session node from the session list on the left side of the client
  And the user clicks on a node in the member tree
  Then the chatbox on the right side of the client should be updated to show communication with the selected node's machine member
  And the user should be able to send and receive messages to and from the selected node's machine member in real-time
\`\`\`

Note: The scenarios have been written as per the provided user story, but additional user stories, workflows, and edge cases may need to be considered while writing and executing BDD test cases.`,
    `\`\`\`gherkin
Feature: Chat-Roles Web Client

Scenario: User selects a chat-roles session node to send a message to the associated chat-roles bot
  Given that I am on the web client
  And there are available chat-roles session nodes
  When I select a session node from the session list
  Then the chatbox displays the history of messages with the selected chat-roles bot
  And I can send and receive messages with the selected chat-roles bot

Scenario: User sends a message to a selected chat-roles bot
  Given that I am on the web client
  And I have selected a chat-roles session node
  When I input a message into the chatbox
  And click send or press enter
  Then the message is sent to the selected chat-roles bot
  And the chatbox displays the sent message along with any response from the bot
\`\`\``,
    `\`\`\`gherkin
Feature: Chat Roles Web Client

Scenario: User can select a session node to chat with its robot
  Given the user has accessed the web client
  When the user selects a session node
  Then the chatbox should display the conversation history with the selected robot
  And the user should be able to chat with the selected robot

Scenario: User can send messages to a selected session node's robot
  Given the user has accessed the web client
  And has selected a session node
  When the user types a message in the chatbox and clicks send
  Then the message should be sent to the selected session node's robot
  And the chatbox should display the sent message
\`\`\``,
    `\`\`\`gherkin
Feature: Chat Roles Web Client

Scenario: User can select a conversation node and talk to the associated chat-roles robot
  Given the web client is connected to the "chat-roles-repo" backend service through REST API
  And there are multiple predefined chat-roles robots available in the backend
  And the user is on the page displaying the list of conversations
  When the user selects a particular conversation node from the list
  Then the conversation box should display the selected chat-roles robot
  And the user should be able to chat with the selected robot
  And the chatbox should allow the user to send messages to the selected robot

Scenario: The chatbox should display the response from the selected robot in real-time
  Given the user has selected a conversation node and chatting with its associated chat-roles robot 
  When the selected robot sends a response message
  Then the chatbox should display the response message in real-time
\`\`\``,
    `\`\`\`gherkin
Feature: View conversation tree

As a user
I want to be able to expand a conversation node
So that I can see the member tree and understand the collaboration of member bots

Scenario: Expand conversation node
  Given the user is on the conversation page
  And there exists a conversation with member bots
  When the user clicks on the expand button of a conversation node
  Then the conversation node should be expanded
  And the member tree under the conversation node should be displayed
\`\`\``,
    `To merge similar features and re-organize them as a JSON object, you can use the following code:

\`\`\`
const features = ["Feature: Chat-roles web client","Feature: Web Client for Chat-Roles","Feature: Chat-Roles Client","Feature: View conversation tree","Feature: Chat Roles Web Client","Feature: Chat-Roles Web Client"];

const mergedFeatures = {
"Feature: Chat-roles web client": "Feature: Chat-Roles Web Client",
"Feature: Web Client for Chat-Roles": "Feature: Chat-Roles Web Client",
"Feature: Chat-Roles Client": "Feature: Chat-Roles Web Client",
"Feature: View conversation tree": "Feature: View conversation tree",
"Feature: Chat Roles Web Client": "Feature: Chat-Roles Web Client",
"Feature: Chat-Roles Web Client": "Feature: Chat-Roles Web Client"
};
\`\`\`

This creates a \`mergedFeatures\` object with the original feature names as keys and their corresponding mapped new feature names as values. Note that all case-sensitive features from the original array are included in the resulting JSON object.`,
    `Here's the merged and re-organized JSON array:
\`\`\`
[
["Scenario: Display session and conversation list\nGiven that I open the web client\nThen the session list should be displayed on the left side\nAnd each session corresponds to a chat-roles robot\nAnd I should see the conversation list displayed on the left-hand side\nAnd each conversation in the list should correspond to a chat-roles bot", [0, 1, 2]],
["Scenario: View conversation history and chat with chat-roles bot\nGiven a conversation node in the list is selected\nThen I should see the chat history for the corresponding chat-roles bot displayed on the right-hand side\nAnd all conversations should be mapped to a specific chat-roles bot\nAnd I should see my message displayed in the conversation history on the right-hand side when I send a message\nAnd I should see the response from the corresponding chat-roles bot", [3, 5, 6, 9, 10, 11, 12, 13, 14]],
["Scenario: Expand and collapse conversation nodes\nGiven any conversation node in the list has sub-nodes\nWhen I click on the node to expand it\nThen I should see the sub-nodes for that conversation node displayed under the parent node\nAnd when I click on the node again to collapse it\nThen I should not see the sub-nodes displayed anymore", [4]],
["Scenario: User can view chat history and communicate with selected session node\nGiven the user has opened the Chat-Roles client\nAnd the user is logged in and connected to the \\"chat-roles-repo\\" backend service\nWhen the user selects a session node from the session list on the left side of the client\nThen the chatbox on the right side of the client should display the chat history for the selected session node\nAnd the chat history should be updated in real-time as new messages are sent and received\nAnd the user should be able to communicate with the selected session node's machine members", [7, 8]]
]
\`\`\``,
  ];
  return [
    rootActorId,
    chat2Actor(aId, 'generate', true, {
      options: {
        testResponses,
      },
    }),
  ];
}
