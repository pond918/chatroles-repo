import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FastifyReply } from 'fastify';
import { ExtractJwt } from 'passport-jwt';
import { AuthService } from './auth.service';

/**
 * auto refreshing jwt
 */
@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  private logger = new Logger(JwtGuard.name);

  constructor(private readonly authService: AuthService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse() as FastifyReply;

    try {
      const ret = await this.activate(context);
      if (!ret) return ret;

      // manual expiration
      const user: any = this.authService.currentActor();
      if (user.expired) {
        // check with saved token.
        const oldToken = ExtractJwt.fromAuthHeaderAsBearerToken()(request);
        const valid = this.authService.validateToken(user.authToken, oldToken);
        if (!valid) throw new UnauthorizedException('User auth token invalid.');

        const newToken = await this.authService.createToken(user.id, true); // token saved to actor
        // request.cookies[Constant.cookieNameAccessToken] = newToken;
        response.header('Authorization', `Bearer ${newToken}`);
      }
      return true;
    } catch (err) {
      err.status == 401 || this.logger.error(err.message, request.url);
      response.removeHeader('Authorization');
      return false;
    }
  }

  async activate(context: ExecutionContext): Promise<boolean> {
    return super.canActivate(context) as Promise<boolean>;
  }
}
