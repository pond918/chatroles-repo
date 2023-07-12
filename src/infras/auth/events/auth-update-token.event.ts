export class AuthUpdateTokenEvent {
  public static readonly eventName = 'auth.update.token';

  constructor(
    public readonly actorId: string,
    public readonly authToken: string,
  ) {}
}
