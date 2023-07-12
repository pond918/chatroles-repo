import { Optional } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

/**
 * a chat prompt consists of a request sentence, and array of response handles.
 */
export class ChatPrompt {
  constructor(prompt = '', to = 'llm') {
    prompt && (this.prompt = prompt);
    to && (this.to = to);
  }

  /** whom to chat: members/llm/parent/owner. if empty, do nothing */
  @ApiProperty({
    description:
      'whom to chat to. format: protocol[:address]. e.g.: @actor1#entry2, llm,.... if empty, do nothing.',
  })
  @IsOptional()
  to?: string;

  @ApiProperty({
    description: 'documentation for the prompt',
    required: false,
  })
  @IsOptional()
  docs?: string;

  @ApiProperty({
    description: 'prompt string, or JSON object, depend on `to`',
    type: 'string | object',
    required: false,
  })
  @IsOptional()
  prompt?: string | object;

  /** if empty, directly pass response to original caller. */
  @ApiProperty({
    description: 'response handlers list. may null.',
    isArray: true,
    required: false,
    type: () => ResponseRule,
  })
  @IsOptional()
  responses?: string | ResponseRule[];
}

export class ResponseRule {
  constructor(then?: string) {
    this.then = then;
  }

  @ApiProperty({
    description:
      'condition expression to activate the rule. (if string, means to `eval`)<br/>\n\
      - `undefined` will match all non-error request<br/>\n\
      - string expression/ChatPrompt will be evaluated to string:<br/>\n\
      &nbsp;&nbsp; - result containing word `yes`|`ok`|`true` will match statusCode==0 request<br/>\n\
      &nbsp;&nbsp; - result containing word `ErrorHandle` will match statusCode!=0 request',
    type: 'string | ChatPrompt',
    required: false,
  })
  @Optional()
  /** semantical match */
  when?: string | ChatPrompt;

  @ApiProperty({
    description: 'action if rule matches. (if string, means to `llm`)',
    type: 'string | ChatPrompt',
    required: false,
  })
  @Optional()
  then?: string | ChatPrompt;

  @ApiProperty({
    description:
      'action if rule NOT matches. if else == {}, means else = then.',
    type: 'string | ChatPrompt',
    required: false,
  })
  @Optional()
  else?: string | ChatPrompt;

  @ApiProperty({
    description: 'execute at end of parent responses queue, if when matches.',
    type: 'string | ChatPrompt',
    required: false,
  })
  @Optional()
  last?: string | ChatPrompt;

  @ApiProperty({
    description:
      'flow control: loop current rule, until `when` not match, or a descendant break to current loop tag',
    type: 'boolean | string',
    required: false,
  })
  @Optional()
  loop?: false;

  @ApiProperty({
    description:
      "flow control, activated if `when` matches: <br/>\
      - if break == false, following rules will be went through;<br/>\
      - if break == true, following rules will be ignored;<br/>\
      - if break == 'breakTag', break until an ancestor.tag == 'breakTag'.",
    type: 'boolean | string',
    required: false,
  })
  @Optional()
  break?: boolean | string = false;

  @ApiProperty({
    description: 'flow control, @see `break`',
    type: 'string',
    required: false,
  })
  @Optional()
  tag?: string;
}
