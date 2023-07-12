export class RolePublishingEvent {
  public static readonly eventName = 'role.publishing';

  constructor(
    public readonly roleId: string,
    public readonly publishing: boolean,
  ) {}
}
