import { MapInterceptor } from '@automapper/nestjs';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtGuard } from '../infras/auth/jwt.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { RoleDto } from './dto/role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './entities/role.entity';
import { RolesService } from './roles.service';
import { AppConstant } from '../app.constants';

@ApiTags('chat-roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @ApiOperation({
    summary: 'create a new role.',
  })
  @Post()
  @UseGuards(JwtGuard)
  @ApiBearerAuth('defaultBearerAuth')
  @ApiCreatedResponse({ type: RoleDto })
  @UseInterceptors(MapInterceptor(Role, RoleDto))
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.$create(createRoleDto);
  }

  @ApiOperation({
    summary: 'get the role by id.',
    description: `e.g. \`${AppConstant.systemUsername}\`,  \`${AppConstant.rolesRoleId}\``,
  })
  @Get(':id')
  @ApiOkResponse({ type: RoleDto })
  @UseInterceptors(MapInterceptor(Role, RoleDto))
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @ApiOperation({
    summary: 'Update the role by id.',
    description:
      'If the role is published, you can still updated it within 36 hours. After that, it is not updatable.',
  })
  @Patch(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('defaultBearerAuth')
  @UseInterceptors(MapInterceptor(Role, RoleDto))
  @ApiAcceptedResponse({ type: RoleDto })
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.rolesService.$update(id, updateRoleDto);
  }

  @ApiOperation({
    summary: 'only the owner can delete the role.',
  })
  @Delete(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('defaultBearerAuth')
  remove(@Param('id') id: string) {
    return this.rolesService.$remove(id);
  }
}
