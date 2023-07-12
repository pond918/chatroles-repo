import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthService } from '../infras/auth/auth.service';
import { PrismaTransactionScope } from '../infras/repos/tx/prisma-tx-scope';
import { UUID } from '../infras/repos/uuid';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolePublishingEvent } from './events/role-publishing.event';
import { Prisma } from '@prisma/client';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesService {
  constructor(
    private readonly transactionScope: PrismaTransactionScope,
    private readonly eventEmitter: EventEmitter2,
    private readonly authService: AuthService,
  ) {}

  async $create(createRoleDto: CreateRoleDto) {
    const rid = await UUID.gen();
    const me = this.authService.currentActor();
    return this.transactionScope.run(async (prisma) => {
      const role = await prisma.role.create({
        data: {
          ...createRoleDto,
          id: rid,
          entries:
            createRoleDto.entries as unknown as Prisma.RoleUpdateentriesInput,
          createdBy: me.ownerId,
        },
      });
      if (createRoleDto.published) {
        await this.eventEmitter.emitAsync(
          RolePublishingEvent.eventName,
          new RolePublishingEvent(role.id, true),
        );
      }
      return role;
    });
  }

  /** updatable it in 36 hours */
  $update(id: string, updateRoleDto: UpdateRoleDto) {
    const me = this.authService.currentActor();
    return this.transactionScope.run(async (prisma) => {
      let role = await prisma.role.findUnique({ where: { id } });
      if (!role || role.createdBy != me.ownerId) throw new NotFoundException();

      const recentUpdated =
        Date.now() - role.updatedAt.getTime() < 36 * 3600000;
      if (role.published && !recentUpdated)
        throw new BadRequestException('Cannot update the published role.');

      if (role.published != updateRoleDto.published) {
        await this.eventEmitter.emitAsync(
          RolePublishingEvent.eventName,
          new RolePublishingEvent(role.id, updateRoleDto.published),
        );
      }

      role = await prisma.role.update({
        where: { id },
        data: {
          ...updateRoleDto,
          entries:
            updateRoleDto.entries as unknown as Prisma.RoleUpdateentriesInput,
        },
      });
      return role;
    });
  }

  findOne(id: string): Promise<Role> {
    return this.transactionScope.run(async (prisma) => {
      return (await prisma.role.findUnique({ where: { id } })) as Role;
    });
  }

  $remove(id: string) {
    const me = this.authService.currentActor();
    return this.transactionScope.run(async (prisma) => {
      const removed = await prisma.role.deleteMany({
        where: { id, createdBy: me.ownerId },
      });
      return removed?.count > 0;
    });
  }
}
