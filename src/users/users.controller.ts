import { MapInterceptor } from '@automapper/nestjs';
import {
  Body,
  Controller,
  Patch,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtGuard } from '../infras/auth/jwt.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

@ApiTags('user-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // @deprecated: new users are created from oauth2
  // @Post()
  // @ApiOperation({
  //   summary: 'Register a new user with `local` LLM configs.',
  //   description:
  //     '`local` configs are safe, since tokens are stored only on user machine. So no user signup needed.',
  // })
  // @ApiCreatedResponse({
  //   type: CreateActorDto,
  //   description:
  //     'Creates new actor of the user. with `authToken` for authentication.',
  // })
  // @ApiCreatedResponse({ type: UserDto })
  // @ApiConflictResponse({ description: 'conflict username' })
  // @UseInterceptors(MapInterceptor(User, UserDto))
  // registerLocalUser(
  //   @Body(LocalLlmsValidationPipe) createUserDto: CreateUserDto,
  // ) {
  //   // TODO is this DDOS safe? CAPTCHA guards?
  //   return this.usersService.registerUserActor(createUserDto);
  // }

  @Patch()
  @ApiOperation({
    summary: 'update current user.',
  })
  @UseGuards(JwtGuard)
  @ApiBearerAuth('defaultBearerAuth')
  @ApiOkResponse({ type: UpdateUserDto })
  @UseInterceptors(MapInterceptor(User, UserDto))
  updateUser(@Body() updateUserDto: UpdateUserDto) {
    return this.usersService.$updateCurrentUser(updateUserDto);
  }

  // @Get(':id')
  // getById(@Param('id') id: string) {
  //   return this.usersService.findOne(id);
  // }
}
