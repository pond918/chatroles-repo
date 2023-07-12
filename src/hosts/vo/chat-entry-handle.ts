import { ApiProperty } from '@nestjs/swagger';
import { ChatEntry } from '../../roles/vo/chat-entry';
import { ChatPrompt } from './chat-prompt';

export class ChatEntryHandle extends ChatEntry {
  @ApiProperty({
    description: 'null means no null entry.',
    type: ChatPrompt,
  })
  handle?: ChatPrompt;
}
