import { Controller } from '@nestjs/common';
import { AuthService } from './auth.service';

/** auth for root user */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // @Post('signup')
  // signup(@Body() createUserDto: CreateUserDto) {
  //   return this.authService.signUp(createUserDto);
  // }

  // @Post('signin')
  // signin(@Body() data: AuthDto) {
  //   return this.authService.signIn(data);
  // }

  // @UseGuards(RefreshTokenGuard)
  // @Get('refresh')
  // refreshTokens(@Req() req: Request) {
  //   const userId = req.user['sub'];
  //   const refreshToken = req.user['refreshToken'];
  //   return this.authService.refreshTokens(userId, refreshToken);
  // }

  // @UseGuards(JwtGuard)
  // @Get('logout')
  // logout(@Req() req: Request) {
  //   this.authService.logout(req.user['sub']);
  // }
}
