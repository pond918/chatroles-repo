import { ConflictException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActorsService } from '../actors/actors.service';
import { AppConstant } from '../app.constants';
import { AuthService } from '../infras/auth/auth.service';
import { PrismaTransactionScope } from '../infras/repos/tx/prisma-tx-scope';
import { LLMsService } from '../llms/llms.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';
import { UserCreatedEvent } from './events/user-created.event';
import { ResourceConfig } from './vo/resource-config';
import { ConfigService } from '@nestjs/config';

/**
 * register a new user, and it's root actor if llm configs exist.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly transactionScope: PrismaTransactionScope,
    private readonly actorsService: ActorsService,
    private readonly llmsService: LLMsService,
    private readonly authService: AuthService,
    private readonly eventEmitter: EventEmitter2,
    protected configService: ConfigService,
  ) {}

  async findOne(id: string): Promise<UserDto> {
    return this.transactionScope.run(async (prisma) => {
      const user = prisma.user.findUnique({
        where: { id },
      });
      return user as unknown as UserDto;
    });
  }

  findByUsername(uname: string, realm = 'local') {
    return this.transactionScope.run(async (prisma) =>
      prisma.user.findFirst({
        where: {
          usernameLower: uname?.toLowerCase(),
          realm,
        },
      }),
    );
  }

  async $updateCurrentUser(updateUserDto: UpdateUserDto) {
    // user/actor has same id
    const actor = this.authService.currentActor();
    const user = await this.findOne(actor.id);
    return this.updateByUsername(updateUserDto, user.username, user.realm);
  }

  updateByUsername(
    user: UpdateUserDto,
    username: string,
    realm = 'local',
    info?: { accessToken: string } & object,
  ) {
    const resConfigs = this._formalResConfigs(user.resConfigs);
    return this.transactionScope.run(async (prisma) =>
      prisma.user.update({
        where: {
          realm_usernameLower: { usernameLower: username.toLowerCase(), realm },
        },
        data: {
          ...user,
          info,
          resConfigs,
          realmToken: info?.accessToken,
        },
      }),
    );
  }

  registerUserActor(
    createUserDto: CreateUserDto,
    realm = 'local',
    info?: { accessToken: string } & object,
  ) {
    return this.transactionScope.run(async () => {
      // create/rollback actor is expensive, so check user first.
      const exists = await this.findByUsername(createUserDto.username, realm);
      if (exists) throw new ConflictException('username already exists.');

      // 2. create root actor
      const newActor = await this.actorsService.$create(
        {
          nick: createUserDto.username,
          avatar: createUserDto.avatar,
          roleId: AppConstant.emptyRoleId,
        },
        true,
      );

      // 3. create user
      createUserDto.id = newActor.id;
      return this._createUser(createUserDto, realm, info);
    });
  }

  protected async _createUser(
    createUserDto: CreateUserDto,
    realm: string,
    info: { accessToken: string } & object,
  ) {
    const resConfigs = this._formalResConfigs(createUserDto.resConfigs);
    return this.transactionScope.run(async (prisma) => {
      const user = await prisma.user.create({
        data: {
          ...createUserDto,
          id: createUserDto.id,
          realm,
          info,
          realmToken: info?.accessToken,
          usernameLower: createUserDto.username.toLowerCase(),
          resConfigs,
        },
      });

      this.eventEmitter.emitAsync(
        UserCreatedEvent.eventName,
        new UserCreatedEvent(user),
      );
      return user;
    });
  }

  /** add platform-llm configs, TODO move to event listener. */
  protected _formalResConfigs(resConfigs: ResourceConfig[]) {
    resConfigs || (resConfigs = []);

    // reset `platform` configs
    resConfigs = resConfigs.filter((r) => r.runtime !== 'platform');
    for (const model of this.llmsService.list()) {
      let envConfig = this.configService.get(
        'res.config.platform.llm.' + model,
      );
      envConfig && (envConfig = JSON.parse(envConfig));
      resConfigs.push({
        name: model,
        url: model,
        type: 'llm',
        runtime: 'platform',
        props: {
          cost: envConfig?.cost,
          quality: envConfig?.quality,
        },
      });
    }
    return resConfigs as any;
  }
}
