import { User } from '@prisma/client';

export class UserCreatedEvent {
  public static readonly eventName = 'user.created';

  constructor(public readonly user: User) {}
}
