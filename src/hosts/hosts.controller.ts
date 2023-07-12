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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../infras/auth/jwt.guard';
import { CreateHostDto } from './dto/create-host.dto';
import { HostDto } from './dto/host.dto';
import { UpdateHostDto } from './dto/update-host.dto';
import { Host } from './entities/host.entity';
import { HostsService } from './hosts.service';

@ApiTags('chat-roles programming')
@UseGuards(JwtGuard)
@ApiBearerAuth('defaultBearerAuth')
@Controller('hosts')
export class HostsController {
  constructor(private readonly hostsService: HostsService) {}

  @Post()
  @UseInterceptors(MapInterceptor(Host, HostDto))
  create(@Body() createHostDto: CreateHostDto) {
    return this.hostsService.$create(createHostDto);
  }

  @Get(':id')
  @UseInterceptors(MapInterceptor(Host, HostDto))
  findOne(@Param('id') id: string) {
    return this.hostsService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(MapInterceptor(Host, HostDto))
  update(@Param('id') id: string, @Body() updateHostDto: UpdateHostDto) {
    return this.hostsService.update(id, updateHostDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.hostsService.remove(id);
  }
}
