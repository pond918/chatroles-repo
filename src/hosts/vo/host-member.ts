import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * a member under current role.
 */
export class HostMember {
  @ApiProperty({
    description:
      'member name. you may `@name` to chat with the member. @Matches(/^[a-zd](?:[a-zd]|-(?=[a-zd])){0,15}$/i)',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(16)
  @Matches(/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,15}$/i)
  name: string;

  /** inherited from role */
  @ApiProperty({
    description: 'avatar. may inherited from role',
    required: false,
  })
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiProperty({
    description: 'member role id.',
  })
  @IsNotEmpty()
  @IsString()
  roleId: string;

  @ApiProperty({
    description: 'member host id.',
  })
  @IsNotEmpty()
  @IsString()
  hostId: string;

  @ApiProperty({
    description:
      'whether the actor is created as early as possible. default false: actor created only on first call.',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  earlyCreate? = false;
}
