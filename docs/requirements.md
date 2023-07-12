# PRD

**Project:** roles.chat

## press release

> [Using product requirement documents and user stories appropriately without creating a mess.](https://shawli.substack.com/p/using-product-requirement-documents)

A question to LLMs(e.g. GPT) may be viewed as a task for it to accomplish.

Complicated tasks (e.g. to develop an APP), need more QAs between users and LLMs. As the rounds of QAs grow, the conversation context may far exceed the LLM token limits (4k or 32k for GPT4). This is where `roles.chat` stands:  

to split the complicated task into several sub-tasks, assign each sub-task to a chat-role with separate conversations. All `chat-roles` work together to achieve the final goal.

The overall rounds of QAs for the task maybe come up to hundreds of thousands, while still keep each `chat-role` under LLM token limits.

## user stories

### user story mapping

> User story mapping is a visualization of the journey a customer takes with a product, from beginning to end. It includes all the tasks they’d typically complete as part of that journey.

```usmap
User chat for questions
    user want to ask LLM for answers
        as a LLM user, I want a chat client, so it can help me prompt.
        Press Shift + T
TextUSM
    Online tool for making user story mapping
        Press Tab to indent lines
        Press Shift + T
```
