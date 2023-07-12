import { CacheTTL } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import { InjectOAuth, OAuthService } from 'nestjs-oauth2';
import { InjectOAuthStateService } from 'nestjs-oauth2/dist/state/state.decorators';
import { StateService } from 'nestjs-oauth2/dist/state/state.service';
import { OAuthAccessTokenEvent } from './events/oauth-access-token-event';

/** auth for root user */
@CacheTTL(0)
@ApiTags('user-auth')
@Controller('oauth')
export class OAuthController {
  constructor(
    @InjectOAuth() private readonly oauthService: OAuthService,
    @InjectOAuthStateService() private readonly stateService: StateService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @ApiOperation({
    summary:
      'OAuth2 login entry, with daily 3k ChatGPT tokens for test for FREE.',
    description:
      'currently supported providers: `github`. response JWT `authToken`.',
    parameters: [{ name: 'provider', in: 'path', example: 'github' }],
  })
  @ApiResponse({ status: 302, description: 'redirect to OAuth server.' })
  @Get(`:provider`)
  async oauthStart(
    @Param(`provider`) provider: string,
    @Res() res: FastifyReply,
  ) {
    const { state } = await this.stateService.create();
    res
      .status(302)
      .redirect(this.oauthService.with(provider).getAuthorizeUrl({ state }));
  }

  @Get(`:provider/callback`)
  async oauthCallback(
    @Param(`provider`) provider: string,
    @Query(`code`) code: string,
    @Query(`state`) state: string,
  ) {
    const verified = this.stateService.verify(state);
    if (!verified) {
      throw new BadRequestException(`Invalid state`);
    }
    const token = await this.oauthService.with(provider).getAccessToken({
      code,
    });
    const resp = await this.eventEmitter.emitAsync(
      OAuthAccessTokenEvent.eventName,
      new OAuthAccessTokenEvent(provider, token),
    );
    return resp?.length && resp[0];
  }

  @Get(`:provider/refresh`)
  async oauthRefresh(
    @Param(`provider`) provider: string,
    @Query(`refreshToken`) refreshToken: string,
  ) {
    const token = await this.oauthService.with(provider).refreshAccessToken({
      refreshToken,
    });
    return this.eventEmitter.emitAsync(
      OAuthAccessTokenEvent.eventName,
      new OAuthAccessTokenEvent(provider, token),
    );
  }
}
