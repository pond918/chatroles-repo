import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { OAuthModule } from 'nestjs-oauth2';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtGuard } from './jwt.guard';
import { JwtStrategy } from './jwt.strategy';
import { OAuthController } from './oauth.controller';
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: async (configService: ConfigService) => {
        return {
          secret: configService.getOrThrow<string>('JWT_SECRET'),
          verifyOptions: {
            ignoreExpiration: true, // manual expiration
          },
        };
      },
      inject: [ConfigService],
    }),
    OAuthModule.forFeatureAsync({
      useFactory: (config: ConfigService) => ({
        providers: [
          {
            name: 'github',
            authorizeUrl: 'https://github.com/login/oauth/authorize',
            accessTokenUrl: 'https://github.com/login/oauth/access_token',
            clientId: config.get('GITHUB_OAUTH_CLIENT_ID'),
            clientSecret: config.get('GITHUB_OAUTH_CLIENT_SECRET'),
            redirectUri: config.get('GITHUB_OAUTH_CALLBACK_URL'),
          },
        ],
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, OAuthController],
  providers: [AuthService, JwtStrategy, JwtGuard],
  exports: [AuthService, JwtGuard],
})
export class AuthModule {}
