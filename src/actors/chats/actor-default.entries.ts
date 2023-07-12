import { ChatEntryHandle } from '../../hosts/vo/chat-entry-handle';
import { ScriptPromptService } from '../../toolbox/plugins/builtin/script.tool';
import { ChatDto } from './dto/chat-dto';

/**
 * default entry has 2 modes: 1. free-style QA chatting; 2. forward to named entry processing.
 */
const defaultEntryHandle = async (
  chatDto: ChatDto,
  promptService: ScriptPromptService,
) => {
  const { data, text } = chatDto;
  chatDto = await promptService.process(chatDto, { to: 'role' });
  const prompt = chatDto.data?.role
    ? `please act as the role: ${JSON.stringify(
        chatDto.data.role,
      )}\nand reply this:\n` + text
    : text;
  chatDto.data = data;
  return promptService.process(chatDto, { to: 'llm', prompt });
};

/**
 * default entry has 2 modes: 1. free-style QA chatting; 2. forward to named entry processing.
 */
export const defaultEntryForwardNamedEntryHandle = async (
  chatDto: ChatDto,
  promptService: ScriptPromptService,
) => {
  const { data, text } = chatDto;
  chatDto = await promptService.process(chatDto, { to: 'role:entries' });
  const role = chatDto.data?.role;
  const entries = role?.entries;
  role && delete role.entries;
  if (entries?.length) {
    chatDto = await promptService.process(chatDto, {
      to: 'llm',
      prompt: `please act as the role: <<req.data.role>>,
you have the ability entries:
${JSON.stringify(entries)}
for the below request:
{
${text}
}
which entry is eligible to handle it?
please reply a json object without explanation:
{name:"name of the entry, or null if none eligible"}`,
    });

    let entry = promptService.toJSON(chatDto.text);
    entry = entry?.name && entries.find((e: any) => e.name == entry.name);
    if (entry) {
      // forward to entry
      return promptService.process(
        { ...chatDto, text, data },
        { to: `@#${entry.name}` },
      );
    }
  }

  const prompt = role
    ? `please act as the role: ${JSON.stringify(
        role,
      )}\nand reply this:\n<<req.text>>`
    : '<<req.text>>';
  return promptService.process(
    { ...chatDto, text, data },
    { to: 'llm', prompt },
  );
};

export const actorDefaultEntries: ChatEntryHandle[] = [
  {
    name: '',
    contextual: false,
    handle: { to: 'script', prompt: defaultEntryHandle.toString() },
  },
  {
    name: 'intro',
    handle: { to: 'role' },
  },
  {
    name: 'command-start',
    handle: { to: 'user-command:start' },
  },
  {
    name: 'command-run',
    handle: { to: 'user-command:run' },
  },
  {
    name: 'command-end',
    handle: { to: 'user-command:end' },
  },
];
