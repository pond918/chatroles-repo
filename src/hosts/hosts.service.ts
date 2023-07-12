import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Actor, Prisma, Role } from '@prisma/client';
import { ChatDto } from '../actors/chats/dto/chat-dto';
import { AuthService } from '../infras/auth/auth.service';
import { PrismaTransactionScope } from '../infras/repos/tx/prisma-tx-scope';
import { UUID } from '../infras/repos/uuid';
import { CreateHostDto } from './dto/create-host.dto';
import { UpdateHostDto } from './dto/update-host.dto';
import { HostMember } from './vo/host-member';
import { RolesService } from '../roles/roles.service';
import { EntityIdExists } from '../infras/validators/entity-exists.validator';

@Injectable()
export class HostsService {
  constructor(
    private readonly transactionScope: PrismaTransactionScope,
    private readonly authService: AuthService,
    private readonly rolesService: RolesService,
  ) {}

  /**
   * FIXME
   * in an actor's context, get member actor,
   * return the actual actor for member role. if not instantiated, create on demand.
   */
  getMemberActor(member: HostMember): Actor {
    // if (member.host.singleton) return member. // singleton has no actor.
    throw new Error('Method not implemented.');
  }

  /** host must be published after role */
  async $create(createHostDto: CreateHostDto) {
    // host must be published after role
    const role =
      EntityIdExists.entity<Role>(createHostDto, 'roleId') ||
      (await this.rolesService.findOne(createHostDto.roleId));
    if (!role)
      throw new NotFoundException('Role not found, ', createHostDto.roleId);
    if (!role.published && createHostDto.published)
      throw new BadRequestException('Please publish role before host publish.');

    const hid = await UUID.gen();
    const me = this.authService.currentActor();
    return this.transactionScope.run(async (prisma) => {
      return await prisma.host.create({
        data: {
          ...(createHostDto as unknown as Prisma.HostUncheckedCreateInput),
          id: hid,
          createdBy: me.ownerId,
        },
      });
    });
  }

  /** host must be published after role */
  update(id: string, updateHostDto: UpdateHostDto) {
    // FIXME host entries must be consistent with role
    return `This action updates a #${id} host`;
  }

  findOne(id: string) {
    if (!id) return null;
    return this.transactionScope.run(async (prisma) => {
      return await prisma.host.findUnique({ where: { id } });
    });
  }

  findNewestByRoleId(roleId: string, published = true) {
    return this.transactionScope.run(async (prisma) => {
      return await prisma.host.findFirst({
        where: { roleId, published },
        orderBy: { pk: 'desc' },
      });
    });
  }

  remove(id: string) {
    return `This action removes a #${id} host`;
  }

  ///////////////// host event handlers

  /** chat event */
  onMemberEntry(
    member: HostMember,
    contextual: boolean,
    data: ChatDto,
    entry: string,
  ) {
    // instantiate member to actor.
    const actor = this.getMemberActor(member);
    return this.onEntry(actor, contextual, data, entry);
  }

  /** chat event */
  onEntry(actor: Actor, contextual: boolean, data: ChatDto, entry: string) {
    const host = actor.hostId && this.findOne(actor.hostId);

    // no host, return nothing.
    if (!host) return null;

    //
  }
}
