import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** user resource config. */
export class ResourceConfig {
  @ApiProperty({
    description: 'resource type, e.g. llm, vdb, restAPI, ...',
  })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty({
    description: 'resource name',
  })
  @IsOptional()
  @IsString()
  name: string;

  @ApiProperty({
    description:
      "How to invoke the resource.\
      <li>`local`: call from user client, user's apiToken stored locally;</li>\
      <li>`server`: call from chat-roles server, user's apiToken stored on server.</li>\
      <li>`platform`: call using chat-roles platform offered apiToken.</li>",
  })
  @IsNotEmpty()
  @IsString()
  runtime: 'local' | 'server' | 'platform';

  @ApiProperty({
    description: 'resource address url',
  })
  @IsNotEmpty()
  @IsString()
  url: string;

  @ApiProperty({
    description: 'additional properties related to the resource.',
    required: false,
  })
  @IsOptional()
  props?: Record<string, any>;
}
