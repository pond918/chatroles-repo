import { UUID } from '../../infras/repos/uuid';

export class ActorEvent {
  public readonly id: string;
  constructor(
    public readonly data: ActorEventPayload,
    public readonly type: string,
    public readonly retry?: number,
  ) {
    this.id = UUID.genSync();
  }
}

export class ActorEventPayload {
  actorId?: string;
  payload: object;
}
