import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';

/**
 * a chat entry may have fixed request/response schema, just like an API.
 */
export class ChatEntry {
  /** empty name means default entry */
  @ApiProperty({
    description: 'empty name means default entry',
  })
  @Allow()
  name?: string;

  @ApiProperty({
    description: 'description of the entry',
  })
  @Allow()
  description?: string;

  @ApiProperty({
    description: 'response `ChatDto.data` json schema validation.',
  })
  @Allow()
  schema?: JSON;

  @ApiProperty({
    description: 'role host control of contextual chat. default unspecified',
  })
  @Allow()
  contextual?: boolean;
}
