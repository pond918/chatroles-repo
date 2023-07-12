import {
  BadRequestException,
  Injectable,
  MethodNotAllowedException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Actor, Prisma, Role } from '@prisma/client';
import { AppConstant } from '../app.constants';
import { HostsService } from '../hosts/hosts.service';
import { HostMember } from '../hosts/vo/host-member';
import { AuthService } from '../infras/auth/auth.service';
import { PrismaTransactionScope } from '../infras/repos/tx/prisma-tx-scope';
import { UUID } from '../infras/repos/uuid';
import { EntityIdExists } from '../infras/validators/entity-exists.validator';
import { RolesService } from '../roles/roles.service';
import { ChatDto } from './chats/dto/chat-dto';
import { CreateActorDto } from './dto/create-actor.dto';
import { UpdateActorDto } from './dto/update-actor.dto';
import { ActorCreateEvent } from './events/actor-create.event';
import { ActorStatus } from './vo/actor-status.enum';

@Injectable()
export class ActorsService {
  constructor(
    private readonly transactionScope: PrismaTransactionScope,
    private readonly eventEmitter: EventEmitter2,
    private readonly authService: AuthService,
    private readonly rolesService: RolesService,
    private readonly hostsService: HostsService,
  ) {}

  /**
   * create a new actor from published role.
   * - parentId: parent.creator == me.owner; !parent.singleton; newActor my descendant
   * - hostId: must be published; if singleton, return singleton actor.
   *
   * @param isRoot newActor.roleId is required if not root actor.
   */
  async $create(newActor: CreateActorDto, isRoot = false) {
    const id = (newActor.id = await UUID.gen());
    // let ctxId = null; // root actor has null ctx.
    if (isRoot) {
      // root actor has empty role, user as host.
      newActor.roleId = AppConstant.emptyRoleId;
      newActor.hostId = null;
      newActor.createdBy = id;
      newActor.ownerId = id;
      newActor.parentId = id;
    } else {
      if (!newActor.roleId)
        throw new BadRequestException('`roleId` is required.');

      const creator = this.authService.currentActor(); // FIXME: use ctx.me
      newActor.createdBy = creator.id;

      ////// parentId
      let parent = null;
      if (newActor.parentId) {
        parent =
          EntityIdExists.entity<Actor>(newActor, 'parentId') ||
          (await this.findOne(newActor.parentId));
        // same owner
        if (parent?.ownerId != creator.ownerId)
          throw new NotFoundException(
            'parentId not found: ' + newActor.parentId,
          );
        // check: newActor must be creator's descendant.
        if (
          newActor.parentId == creator.parentId &&
          creator.id != creator.parentId
        )
          throw new MethodNotAllowedException(
            "the actor must be creator's descendant. invalid parentId: " +
              newActor.parentId,
          );
      } else {
        parent = creator;
        newActor.parentId = parent.id; // under the creator's root actor.
      }
      // check parent must not a singleton.
      if (parent.singleton)
        throw new MethodNotAllowedException(
          'Singleton actor cannot be parent: ' + parent.id,
        );
      newActor.ownerId = parent.ownerId; // must be a user.
      newActor.ctxId = parent.ctxId; // propagation

      /////// host
      const hostPublished = await this.hostsService.findNewestByRoleId(
        newActor.roleId,
        true,
      );
      newActor.hostId = hostPublished?.id; // may null
      newActor.singleton = hostPublished?.singleton; // null host is not singleton

      if (!newActor.nick || !newActor.avatar) {
        const role =
          EntityIdExists.entity<Role>(newActor, 'roleId') ||
          (await this.rolesService.findOne(newActor.roleId));
        newActor.nick || (newActor.nick = role.nick);
        newActor.avatar || (newActor.avatar = role.avatar);
      }
      // ctxId = creator.ctxId;
    }

    return await this._createActor(newActor as Required<CreateActorDto>);
  }

  /**
   * 'id' | 'avatar' | 'authToken' are optional
   */
  async _createActor(newActor: Required<CreateActorDto>, reqDto?: ChatDto) {
    const id = newActor.id || (newActor.id = await UUID.gen());
    // generate token
    newActor.authToken = await this.authService.createToken(id, false);
    // if (newActor.hostId) {
    //   newActor = { ...newActor, host: { connect: { id: member.hostId } } };
    // }

    // lifecycle events
    return this.transactionScope.run(async (prisma) => {
      // ctx must consistent with parent
      if (!newActor.ctxId && newActor.parentId) {
        const parent = await prisma.actor.findUnique({
          where: { id: newActor.parentId },
        });
        newActor.ctxId = parent?.ctxId;
      }

      // FIXME error msg for: @@unique([parentId, nick])
      const actor = await prisma.actor.create({
        data: newActor,
        include: { host: true },
      });
      // create event must handled sync.
      await this.eventEmitter.emitAsync(
        ActorCreateEvent.eventName,
        new ActorCreateEvent(actor, actor.host, reqDto),
      );
      return actor;
    });
  }

  async createMember(actor: Actor, member: HostMember, reqDto?: ChatDto) {
    const newActor = new CreateActorDto();
    newActor.roleId = member.roleId;
    newActor.hostId = member.hostId;
    newActor.nick = member.name;
    newActor.avatar = member.avatar;
    newActor.ownerId = actor.ownerId;
    newActor.createdBy = actor.id;

    newActor.parentId = actor.id;
    newActor.ctxId = actor.ctxId; // propagate ctx from parent.

    // async, new actors persisted in db
    return this._createActor(newActor as Required<CreateActorDto>, reqDto);
  }

  findOne(id: string) {
    return this.transactionScope.run(async (prisma) => {
      return await prisma.actor.findUnique({
        where: { id },
      });
    });
  }

  /**
   * @returns may null
   */
  findMember(id: string, memberName: string) {
    return this.transactionScope.run(async (prisma) => {
      return await prisma.actor.findFirst({
        where: { parentId: id, nick: memberName },
      });
    });
  }

  update(id: string, data: UpdateActorDto) {
    return this.transactionScope.run(async (prisma) => {
      return await prisma.actor.update({
        where: { id },
        data,
      });
    });
  }

  updateToken(id: string, authToken: string) {
    return this.transactionScope.run(async (prisma) => {
      return await prisma.actor.update({
        where: { id },
        data: { authToken },
      });
    });
  }

  /** update actor.ctxId, and all descendent ctxId. */
  updateCtxIds(actor: Actor, ctxId: number) {
    return this.transactionScope.run(async (prisma) => {
      let ids = [actor.id];
      while (ids.length > 0) {
        await prisma.$executeRaw`update actors set ctx_id=${ctxId} where owner_id=${
          actor.ownerId
        } and id in (${Prisma.join(ids)})`;
        ids = await prisma.$queryRaw<
          string[]
        >`select id from actors where owner_id=${
          actor.ownerId
        } and parent_id in (${Prisma.join(ids)})`;
      }

      // entity in mem not updated.
      actor.ctxId = ctxId;
    });
  }

  /** status into ctx scoped storage */
  async updateStatus(status: ActorStatus, ctx: Record<string, any>) {
    // for ref only
    const me = await ctx.me;
    me.status = status;
    ctx['me.status'] = status; // store into storage.
  }

  async getStatus(ctx: Record<string, any>): Promise<ActorStatus> {
    const me = await ctx.me;
    return me.status;
  }

  $remove(id: string) {
    const me = this.authService.currentActor();
    return this.transactionScope.run(async (prisma) => {
      const removed = await prisma.actor.deleteMany({
        where: { id, createdBy: me.ownerId },
      });
      return removed?.count > 0;
    });
  }
}
