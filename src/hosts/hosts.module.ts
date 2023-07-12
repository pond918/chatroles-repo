import { Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module';
import { HostsController } from './hosts.controller';
import { HostsService } from './hosts.service';
import { RoleUnpublishedListener } from './listeners/role-unpublished.listener';

@Module({
  controllers: [HostsController],
  providers: [HostsService, RoleUnpublishedListener],
  exports: [HostsService],
  imports: [RolesModule],
})
export class HostsModule {}
