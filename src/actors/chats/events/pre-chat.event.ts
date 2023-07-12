import { Actor } from '@prisma/client';
import { ChatEntryHandle } from '../../../hosts/vo/chat-entry-handle';
import { ChatDto } from '../dto/chat-dto';

export class PreChatEvent {
  public static readonly eventName = 'chat.pre';

  constructor(
    public readonly actor: Actor,
    public readonly contextual: boolean,
    public readonly entryCmd: ChatEntryHandle,
    public readonly reqDto?: ChatDto,
  ) {}
}
