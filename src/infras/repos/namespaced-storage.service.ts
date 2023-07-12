import { Injectable } from '@nestjs/common';

export abstract class NamespacedStorage {
  /** get/create a ns */
  abstract getNamespace(name: string, create: boolean): NsStorage;
  abstract destroyNamespace(name: string): boolean;
}

export abstract class NsStorage {
  constructor(
    /** whether newly created */
    public _newly,
  ) {}

  abstract has(key: string | number): boolean;
  /** return max unused id */
  abstract maxId(): number;
  abstract get<T>(key: string | number): T;
  abstract set(key: string | number, data: any): boolean;
  abstract remove(key: string | number): boolean;
  abstract keys(): IterableIterator<string | number>;
}

@Injectable()
export class MemNamespacedStorage extends NamespacedStorage {
  private readonly store = new Map<string, NsStorage>();

  getNamespace(name: string, create: boolean): NsStorage {
    let ns = this.store.get(name);
    if (!ns && create) {
      this.store.set(name, (ns = new MemNsStorage(true)));
    } else if (ns?._newly) ns._newly = false;
    return ns;
  }

  destroyNamespace(name: string): boolean {
    return this.store.delete(name);
  }
}

/** not for production */
class MemNsStorage extends NsStorage {
  private readonly store = new Map<string | number, any>();
  private readonly maxIdKey = '__maxIdKey_';
  constructor(newly: boolean) {
    super(newly);
  }

  has(key: string | number): boolean {
    return this.store.has(key);
  }
  /** return max unused id */
  maxId(): number {
    let id = this.store.get(this.maxIdKey) || 0;
    this.store.set(this.maxIdKey, ++id);
    return id;
  }

  get<T>(key: string | number): T {
    return this.store.get(key);
  }
  set(key: string | number, data: any): boolean {
    const has = this.has(key);
    this.store.set(key, data);
    return has;
  }
  remove(key: string | number): boolean {
    return this.store.delete(key);
  }
  keys(): IterableIterator<string | number> {
    return this.store.keys();
  }
}
