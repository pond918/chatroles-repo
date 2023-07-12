import { BadRequestException, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import axios from 'axios';
import { OAuthAccessTokenEvent } from '../../infras/auth/events/oauth-access-token-event';
import { UsersService } from '../users.service';
import { ActorsService } from '../../actors/actors.service';

@Injectable()
export class OAuthAccessTokenListener {
  constructor(
    protected usersService: UsersService,
    protected actorsService: ActorsService,
  ) {}

  // sync op to prepare ctx into req.
  @OnEvent(OAuthAccessTokenEvent.eventName, { async: false })
  async handleEvent(event: OAuthAccessTokenEvent) {
    const { provider, token } = event;

    let user;
    switch (provider) {
      case 'github':
        const { accessToken } = token;
        if (!accessToken) throw new BadRequestException(token);

        // get user by token
        const u = (
          await axios.get('https://api.github.com/user', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-type': 'application/json',
            },
          })
        ).data;
        if (!u?.id)
          throw new Error(`${provider} login failed, ${JSON.stringify(u)}`);
        u.id = u.id.toString();
        u.accessToken = accessToken;

        // upsert user
        user = await this.usersService.findByUsername(u.id, provider);
        const data = {
          nick: u.login,
          avatar: u.avatar_url,
          email: u.email,
          emailValid: !!u.email,
          username: u.id,
          usernameLower: u.id.toLowerCase(),
          resConfigs: [],
        };
        if (user) {
          user = await this.usersService.updateByUsername(
            data,
            u.id,
            provider,
            u,
          );
        } else {
          user = await this.usersService.registerUserActor(data, provider, u);
        }
        break;
      default:
        throw new BadRequestException(
          'unsupported oauth2 provider: ' + provider,
        );
    }

    if (user) {
      const actor = await this.actorsService.findOne(user.id);
      user.authToken = actor.authToken;
      delete user.pk;
      delete user.realmToken;
    }
    return user;
  }
}
