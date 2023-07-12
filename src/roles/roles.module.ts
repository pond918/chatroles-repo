import { Module } from '@nestjs/common';
import { RolePublishingListener } from './listeners/role-published.listener';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service'; // nestjs bug: RolesService MUST before RolesController

@Module({
  controllers: [RolesController],
  providers: [RolesService, RolePublishingListener],
  exports: [RolesService],
})
export class RolesModule {}
