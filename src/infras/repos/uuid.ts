import { nanoid } from 'nanoid';
import { nanoid as nanoidAsync } from 'nanoid/async';

export class UUID {
  static readonly gen = () => nanoidAsync();
  static readonly genSync = () => nanoid();
}
