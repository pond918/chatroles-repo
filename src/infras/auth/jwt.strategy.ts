import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { PassportStrategy } from '@nestjs/passport';
import { Cache } from 'cache-manager';
import { default as ms } from 'ms';
import { ClsService } from 'nestjs-cls';
import { ExtractJwt, Strategy as PassportJwtStrategy } from 'passport-jwt';
import { ActorsService } from '../../actors/actors.service';
import { ActorDto } from '../../actors/dto/actor.dto';
import { AppConstant } from '../../app.constants';
import { JwtPayload } from './auth.service';

@Injectable()
export class JwtStrategy
  extends PassportStrategy(PassportJwtStrategy)
  implements OnModuleInit
{
  private expireInMs: number;
  private actorsService: ActorsService;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly configService: ConfigService,
    private readonly clsService: ClsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
    this.expireInMs = parseInt(
      ms(this.configService.getOrThrow<number>('JWT_REFRESH_EXPIRES_IN')),
    );
  }

  async onModuleInit() {
    this.actorsService = await this.moduleRef.get(ActorsService, {
      strict: false,
    });
  }

  /** validate the decoded jwt payload. */
  async validate(payload: JwtPayload): Promise<ActorDto> {
    const { id, ts } = payload;

    const actor: any = await this.fineUser(id);
    actor.expired = Date.now() - ts > this.expireInMs;
    this.clsService.set(AppConstant.clsKeyCurrentUser, actor);

    return actor; // returned value on req.user
  }

  private async fineUser(id: string): Promise<any> {
    let user = await this.cacheManager.get('_USER_' + id);
    if (!user) {
      user = await this.actorsService.findOne(id);
      this.cacheManager.set('_USER_' + id, user, 60000);
    }
    return user;
  }
}
