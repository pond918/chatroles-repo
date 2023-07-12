import { BadRequestException, PipeTransform } from '@nestjs/common';
import { CreateUserDto } from '../dto/create-user.dto';
import { ResourceConfig } from '../vo/resource-config';

/**
 * valid if all llm configs are `local`
 */
export class LocalLlmsValidationPipe implements PipeTransform<CreateUserDto> {
  constructor(private readonly propName = 'resConfigs') {}

  transform(value: any) {
    const resConfigs = this.propName ? value[this.propName] : value;
    const containsNonLocal = resConfigs?.reduce(
      (pre, config: ResourceConfig) => {
        if (config.type != 'llm') return pre;
        if (config.runtime == 'local') {
          return pre;
        }
        return true;
      },
      false,
    );
    if (containsNonLocal)
      throw new BadRequestException(
        `LLMs api token type must contain \`local\`, ${this.propName}[*].runtime.`,
      );

    return value;
  }
}
