export class OAuthAccessTokenEvent {
  public static readonly eventName = 'oauth.access.token';

  constructor(public readonly provider: string, public readonly token: any) {}
}
