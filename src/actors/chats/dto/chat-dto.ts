import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { SimpleChatPrompt } from '../../prompts/prompts.service';

class ChatOptions {
  @ApiProperty({
    description:
      'max rounds of QAs you would like to wait, before the result is figured out by roles. if exceeds:<br/>\
    - positive means stop and return without result.<br/>\
    - negative means return without result, result will be informed to user through async event log.<br/>\
    - null means unlimited.',
    required: false,
  })
  @IsInt()
  @IsOptional()
  maxQAs?: number | null;

  /** if true, this msg & it's response will not be stored into context. */
  @ApiProperty({
    description:
      "if true, this msg & it's response will not be stored into context.",
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  stateless?: boolean;

  /** callback to stream the results */
  stream?: (msg: ChatDto) => void;

  @ApiProperty({
    description: 'Number of completions to generate for each prompt',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  temperature?: number;

  @ApiProperty({
    description: 'Number of completions to generate for each prompt',
    required: false,
  })
  @IsInt()
  @IsOptional()
  n?: number;

  @ApiProperty({
    description: 'Total probability mass of tokens to consider at each step',
    required: false,
  })
  @IsInt()
  @IsOptional()
  topP?: number;

  @ApiProperty({
    description:
      "Maximum number of tokens to generate in the completion. -1 returns as many tokens as possible given the prompt and the model's maximum context size.",
    required: false,
  })
  @IsInt()
  @IsOptional()
  maxTokens?: number;

  /** token usage quota: remain tokens to use */
  @ApiResponseProperty()
  quotaTokens?: number;
}

export class ChatDto {
  @ApiProperty({
    description:
      'llm contextual parent message id. null means append to current conversation. empty string means start new conversation.',
    required: false,
  })
  @IsString()
  @IsOptional()
  lastMsgId?: string;

  /**
   *
   * @param statusCode 0: success; 1: result will be informed later; -1: task terminated.
   */
  constructor(text?: string, statusCode = 0) {
    this.text = text;
    this.statusCode = statusCode;
    // mark maxQAs exceeds
    if (statusCode) this.options.maxQAs = -1;
  }
  @ApiProperty({
    description: 'chat text content',
    required: false,
  })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiProperty({
    description: 'chat request/response json content',
    required: false,
  })
  @IsOptional()
  data?: any;

  @ApiProperty({
    description:
      'response code. =0: success; >0: task continues async, result will be informed by sse log; <0: task terminated.',
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  statusCode? = 0;

  @ApiResponseProperty()
  message?: string;

  @ApiProperty({
    type: ChatOptions,
    description: 'extensible chat options',
    required: true,
  })
  @IsNotEmpty()
  options: ChatOptions & Record<string, any> = {};

  static error(
    dto: ChatDto,
    code: number,
    msg: string,
    chatPrompt?: SimpleChatPrompt,
  ) {
    dto.statusCode || (dto.statusCode = code);
    dto.message || (dto.message = msg);
    dto.options.error_step ||
      (chatPrompt && (dto.options.error_step = chatPrompt));
    return dto;
  }
}
