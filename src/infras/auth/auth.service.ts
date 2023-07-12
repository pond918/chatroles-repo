import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
// import * as argon2 from 'argon2';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Actor } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { AppConstant } from '../../app.constants';
import { AuthUpdateTokenEvent } from './events/auth-update-token.event';

export type JwtPayload = {
  id: string;
  ts: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly clsService: ClsService,
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * @throws UnauthorizedException if no current user.
   */
  currentActor(): Actor {
    const user = this.clsService.get(AppConstant.clsKeyCurrentUser);
    if (!user) throw new UnauthorizedException('');
    return user;
  }

  // async signUp(createActorDto: CreateActorDto): Promise<any> {
  //   // Check if actor exists
  //   const actorExists = await this.actorsService.findByActorname(
  //     createActorDto.username,
  //   );
  //   if (actorExists) {
  //     throw new BadRequestException('Actor already exists');
  //   }

  //   // Hash password
  //   const hash = await this.hashData(createActorDto.password);
  //   const newActor = await this.actorsService.create({
  //     ...createActorDto,
  //     password: hash,
  //   });
  //   const tokens = await this.getTokens(newActor._id, newActor.username);
  //   await this.updateRefreshToken(newActor._id, tokens.refreshToken);
  //   return tokens;
  // }

  // async signIn(data: AuthDto) {
  //   // Check if actor exists
  //   const actor = await this.actorsService.findByActorname(data.username);
  //   if (!actor) throw new BadRequestException('Actor does not exist');
  //   const passwordMatches = await argon2.verify(actor.password, data.password);
  //   if (!passwordMatches)
  //     throw new BadRequestException('Password is incorrect');
  //   const tokens = await this.createTokens(actor._id, actor.username);
  //   await this.updateRefreshToken(actor._id, tokens.refreshToken);
  //   return tokens;
  // }

  // async logout(actorId: string) {
  //   return this.actorsService.update(actorId, { refreshToken: null });
  // }

  /** create accessToken, save to actor.authToken */
  async createToken(actorId: string, save = true) {
    const accessToken = this.jwtService.sign(
      {
        id: actorId,
        ts: Date.now(),
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        // expiresIn: this.configService.getOrThrow<string>('JWT_EXPIRES_IN'),
      },
    );
    // const hashedToken = await argon2.hash(accessToken);
    // console.log(hashedToken);
    // const result =
    // FIXME save && (await this.actorsService.updateToken(actorId, accessToken));
    if (save)
      this.eventEmitter.emit(
        AuthUpdateTokenEvent.eventName,
        new AuthUpdateTokenEvent(actorId, accessToken),
      );
    return accessToken;
  }

  validateToken(savedToken: string, accessToken: string) {
    return savedToken === accessToken; // argon2.verify(hashedToken, accessToken);
  }

  // async refreshTokens(actorId: string, refreshToken: string) {
  //   const actor = await this.actorsService.findOne(actorId);
  //   if (!actor || !actor.refreshToken)
  //     throw new ForbiddenException('Access Denied');

  //   const refreshTokenMatches = await argon2.verify(
  //     actor.refreshToken,
  //     refreshToken,
  //   );
  //   if (!refreshTokenMatches) throw new ForbiddenException('Access Denied');

  //   const tokens = await this.getTokens(actor.id, actor.id);
  //   await this.updateRefreshToken(actor.id, tokens.refreshToken);
  //   return tokens;
  // }
}
