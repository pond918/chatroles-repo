import { Mapper, MappingProfile, createMap } from '@automapper/core';
import { AutomapperProfile, InjectMapper } from '@automapper/nestjs';
import { Injectable } from '@nestjs/common';
import { ActorDto } from '../../actors/dto/actor.dto';
import { Actor } from '../../actors/entities/actor.entity';
import { HostDto } from '../../hosts/dto/host.dto';
import { Host } from '../../hosts/entities/host.entity';
import { RoleDto } from '../../roles/dto/role.dto';
import { Role } from '../../roles/entities/role.entity';
import { UserDto } from '../../users/dto/user.dto';
import { User } from '../../users/entities/user.entity';

/** auto copy properties only in destination dto */
@Injectable()
export class DtoMapperProfile extends AutomapperProfile {
  constructor(@InjectMapper() mapper: Mapper) {
    super(mapper);
  }

  get profile(): MappingProfile {
    return (mapper) => {
      createMap(mapper, Role, RoleDto);
      createMap(mapper, Host, HostDto);
      createMap(mapper, Actor, ActorDto);
      createMap(mapper, User, UserDto);
    };
  }
}
