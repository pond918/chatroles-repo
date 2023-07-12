import { Injectable } from '@nestjs/common';
import {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';
import { PrismaTransactionScope } from '../repos/tx/prisma-tx-scope';

export function EntityIdExists(
  entityName: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: any, propertyName: string) {
    const objClass = object.constructor;

    // override propertyName to return entity instead of id.
    // const propValues = new WeakMap();
    // Object.defineProperty(objClass.prototype, propertyName, {
    //   get: function () {
    //     return (
    //       this[EntityIdExistsRule.ENTITY_PREFIX + propertyName] ||
    //       propValues[this]
    //     );
    //   },
    //   set: function (v) {
    //     propValues[this] = v;
    //   },
    // });
    registerDecorator({
      name: 'EntityIdExists',
      target: objClass,
      propertyName: propertyName,
      constraints: [entityName],
      options: validationOptions,
      validator: EntityIdExistsRule,
    });
  };
}

/** minor optimize to reuse the previously checked entity object. */
EntityIdExists.entity = <T>(target: any, propertyName: string): T => {
  return target[ENTITY_PREFIX + propertyName];
};

const ENTITY_PREFIX = '$entityOf_';

/**
 * check entity only one existence by `id`.
 */
@Injectable()
@ValidatorConstraint({ name: 'EntityIdExists', async: true })
export class EntityIdExistsRule implements ValidatorConstraintInterface {
  constructor(private readonly transactionScope: PrismaTransactionScope) {}

  async validate(value: string, args: ValidationArguments) {
    if (!value) return true; // empty no validation
    const entityName = args.constraints[0];
    try {
      return this.transactionScope.run(async (prisma) => {
        const entity = await prisma[entityName].findUnique({
          where: { id: value },
        });

        const entityField = ENTITY_PREFIX + args.property;
        // store entity for reuse
        if (entity && args.object && !args.object[entityField]) {
          Object.defineProperty(args.object, entityField, {
            value: entity,
            enumerable: false, // 不可枚举, json出不来
            configurable: true,
          });
        }

        return !!entity;
      });
    } catch (e) {
      console.error(e, entityName, value);
      return false;
    }
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property}#${args.value} doesn't exist`;
  }
}
