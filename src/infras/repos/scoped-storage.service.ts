import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { NamespacedStorage, NsStorage } from './namespaced-storage.service';

/**
 * scoped storage factory, maintaining chained scope storages. with 3 levels of namespaces:
 * - '_nsScopeChain': {{scopeId}: scopeData}, stores all chained scope data
 * - '_scope_{id}': {_var_{ns_name}: true}, stores all var namespace keys for the scope
 * - '_var_{scopeId}_{ns_name}': stores all variables for ns_name the scope
 */
@Injectable()
export class ScopedStorageMan {
  private readonly nsScopeChain = '_nsScopeChain';
  private readonly clsRequestScope = '_clsRequestScope';
  constructor(
    private readonly nsStorage: NamespacedStorage,
    private readonly clsService: ClsService,
  ) {
    this._clsNamespacedStorage = new ClsNamespacedStorage(clsService);
  }

  /**
   * create scope under parent, then store into cls req.
   * - root scope must be longrun
   * - longrun parent has 0|1 longrun child, so existing longrun child will return.
   * - longrun parent has * non-longrun child in cls req. existing req scope will be overwritten for same req.
   *
   * @param parentId: parent ctx id.
   * @param longrun: longrun scope, or request scope.
   */
  async createScope(
    parentId: number | null,
    longrun: boolean,
    scopeName?: string,
  ) {
    // existing
    if (longrun) {
      if (parentId) {
        const parent = await this.getScope(parentId);
        if (!parent) throw new NotFoundException('no scope found: ' + parentId);
        if (parent.data.childId) {
          const scope = await this.getScope(parent.data.childId);
          if (scope) {
            if (scope.data.name !== scopeName)
              throw new BadRequestException(
                `scope names conflict, ${scope.data.name} : ${scopeName}`,
              );
            return scope;
          }
        }
      }
    } else if (!parentId)
      throw new BadRequestException('root scope must be longrun');
    // create new.
    return this._createScope(parentId, longrun, scopeName);
  }

  /** create new scope & store into cls req. */
  private async _createScope(
    parentId: number | null,
    longrun: boolean,
    name: string,
  ): Promise<ScopedStorage> {
    let data: ScopeData;
    if (!longrun) {
      data = { id: 0, parentId, name };
    } else {
      const ns = await this.nsStorage.getNamespace(this.nsScopeChain, true);
      const id = await ns.maxId();

      // FIXME: tx
      data = { id, parentId, name };
      // no check existing child.
      await this._upsertScope(id, data, ns);
      if (parentId) {
        const parent: ScopeData = await ns.get(parentId);
        parent.childId = id;
        await this._upsertScope(parentId, parent, ns);
      }
    }
    this._storeCls(data);
    return new ScopedStorage(data, this, this._getNsStorage(data));
  }

  protected _storeCls(data) {
    this.clsService.set(this.clsRequestScope, data);
  }

  /**
   * @param id if empty, get scope on current request context.
   * @param storeRequest store into cls req, if exists
   * @param data get storage from data.
   * @returns may null.
   */
  async getScope(id?: number, storeRequest = false, data?: any) {
    data || (data = this.clsService.get(this.clsRequestScope)); // existing
    if (id && (!data || id != data.id)) {
      const storage = await this._getScope(id);
      if (storeRequest && storage) this._storeCls(storage.data);
      return storage;
    }

    if (!data) return; // request scope
    if (storeRequest) this._storeCls(data);
    return new ScopedStorage(data, this, this._getNsStorage(data));
  }

  async getRootScope(id: number) {
    let scope: ScopedStorage;
    do {
      scope = await this.getScope(id);
    } while (scope?.data.parentId);
    return scope;
  }

  private async _getScope(id: number, ns: NsStorage = null) {
    ns || (ns = await this.nsStorage.getNamespace(this.nsScopeChain, true));
    const data: ScopeData = await ns.get(id);
    if (!data) return;
    return new ScopedStorage(data, this, this._getNsStorage(data));
  }

  /** destroy scope and all sub scopes, returns it's parent scope. */
  async destroyScope(id: number): Promise<ScopedStorage> {
    if (!id) return;
    const ns = await this.nsStorage.getNamespace(this.nsScopeChain, true);
    let scope = await this._getScope(id, ns);
    if (!scope?.data)
      throw new NotFoundException('no scope found with id=' + id);
    const parent =
      scope.data.parentId && (await this._getScope(scope.data.parentId, ns));

    do {
      scope.destroy();
      ns.remove(scope.data.id); // chain ns
      scope =
        scope.data.childId && (await this._getScope(scope.data.childId, ns));
    } while (scope?.data?.id);

    parent.data.childId = null;
    await this._upsertScope(parent.data.id, parent.data, ns);
    return parent;
  }

  private async _upsertScope(scopeId: number, data: ScopeData, ns?: NsStorage) {
    ns || (ns = await this.nsStorage.getNamespace(this.nsScopeChain, true));
    await ns.set(scopeId, data);
  }

  /** returns storage, or cls */
  private _getNsStorage(data: ScopeData): NamespacedStorage {
    if (data.id) return this.nsStorage;
    return this._clsNamespacedStorage;
  }

  private readonly _clsNamespacedStorage: NamespacedStorage;
}
class ClsNamespacedStorage extends NamespacedStorage {
  constructor(private readonly clsService: ClsService) {
    super();
  }
  getNamespace(name: string): NsStorage {
    return new ClsNsStorage(name, this.clsService);
  }
  destroyNamespace() {
    return false;
  }
}
/** isolate diff namespace */
class ClsNsStorage extends NsStorage {
  constructor(
    private readonly namespace: string,
    private readonly clsService: ClsService,
  ) {
    super(false);
    this.namespace = namespace || '';
  }
  has(key: string) {
    key = this.namespace + key;
    return this.clsService.has(key) || this.clsService.get(key) !== undefined;
  }
  maxId() {
    return 0;
  }
  get<T>(key: string | number): T {
    return this.clsService.get(this.namespace + key);
  }
  set(key: string | number, data: any): boolean {
    this.clsService.set(this.namespace + key, data);
    return true;
  }
  remove(key: string | number): boolean {
    this.clsService.set(this.namespace + key, undefined);
    return true;
  }
  keys() {
    return null;
  }
}

type ScopeData = {
  /** 0 means request scope */
  id: number;
  // FIXME rootId: number;
  parentId?: number;
  childId?: number;
  name?: string;
};
/** scoped storage object */
export class ScopedStorage {
  constructor(
    public readonly data: ScopeData,
    /** storage for all scopes */
    private readonly storage: ScopedStorageMan,
    /** namespace storage. */
    private readonly nsStorage: NamespacedStorage,
  ) {}

  async getId(root = false): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let scope: ScopedStorage = this;
    while (root && scope.data.parentId)
      scope = await this.storage.getScope(scope.data.parentId);
    return scope.data.id;
  }

  /** get value from this and all parent scopes */
  async get<T>(
    varName: string,
    namespace: string,
    rootCtx = false,
  ): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let scope: ScopedStorage = this;
    while (rootCtx || !(await scope.has_(varName, namespace))) {
      if (!scope?.data.parentId) {
        rootCtx || (scope = null);
        break;
      }
      scope = await this.storage.getScope(scope.data.parentId);
    }
    return scope?._get(varName, namespace);
  }

  /** set value only in current scope */
  async set(varName: string, value: any, namespace: string, rootCtx = false) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let scope: ScopedStorage = this;
    while (rootCtx && !(await scope.has_(varName, namespace))) {
      if (!scope?.data.parentId) {
        rootCtx || (scope = null);
        break;
      }
      scope = await this.storage.getScope(scope.data.parentId);
    }

    const varSpace = await scope._getVarSpace(namespace, true);
    return varSpace.set(varName, value);
  }

  /** get in current scope. */
  protected async _get<T>(varName: string, namespace: string): Promise<T> {
    const varSpace = await this._getVarSpace(namespace);
    return varSpace?.get(varName);
  }

  /** has in current scope */
  async has_(varName: string, namespace: string) {
    const scopeSpace = await this._getVarSpace(namespace);
    return scopeSpace?.has(varName);
  }

  /** remove var namespace in this scope. */
  async remove(namespace: string) {
    this._removeVarSpace(namespace);
  }

  /** destroy the scope, and all var spaces in the scope */
  async destroy() {
    const scopeSpace = await this._getScopeNamespace();
    const varSpaceKeys = await scopeSpace.keys();
    if (!varSpaceKeys) return;
    for (const varKey of varSpaceKeys) {
      this._removeVarSpace(varKey as string);
    }
    return this._removeScopeNamespace();
  }

  /** get/create a ns */
  private async _getScopeNamespace() {
    return await this.nsStorage.getNamespace('_scope_' + this.data.id, true);
  }

  private async _removeScopeNamespace() {
    return await this.nsStorage.destroyNamespace('_scope_' + this.data.id);
  }

  private async _getVarSpace(namespace: string, create = false) {
    const nsName = '_var_' + this.data.id + '_' + namespace;
    const ns = await this.nsStorage.getNamespace(nsName, create);
    // record newly created space
    if (ns?._newly) (await this._getScopeNamespace()).set(nsName, true);
    return ns;
  }

  private async _removeVarSpace(namespace: string) {
    const nsName = '_var_' + this.data.id + '_' + namespace;
    return this.nsStorage.destroyNamespace(nsName);
  }
}
