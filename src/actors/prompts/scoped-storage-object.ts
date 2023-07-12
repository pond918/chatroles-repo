import { ScopedStorage } from '../../infras/repos/scoped-storage.service';

export const unwrapScopedStorage = async (
  proxy: any,
): Promise<ScopedStorage> => {
  const { storage } = await proxy[ORIG_TARGET];
  return storage;
};

/** symbol to get the original `ScopedStorage` */
const ORIG_TARGET = Symbol('proxy_target_identity');

/** expose scoped storage variables as readonly properties */
export const wrapScopedStorageObject = (
  storage: ScopedStorage,
  extra: object,
  namespace: string,
  rootCtx: boolean,
): Record<string, any> => {
  return new Proxy(
    { storage, extra, namespace, rootCtx },
    {
      /** get from extra, if no, get from storage */
      get: async function (target, prop) {
        const { storage, extra } = target;
        if (prop === 'then') return undefined;
        if (prop === ORIG_TARGET) return target;
        if (prop === 'id') return storage.getId();

        if (extra && prop in extra) return extra[prop];

        return await storage.get(prop.toString(), namespace, rootCtx);
      },

      /**
       * can only set into storage. extra props are readonly
       * NOTE: cannot await the operation. you have to unwrap storage to await.
       */
      set: function (target, prop, newValue) {
        const { storage } = target;
        // set operation is async...
        storage.set(prop.toString(), newValue, namespace, rootCtx);
        return true;
      },

      /** can only delete storage vars, in current storage scope, parent scopes readonly */
      // deleteProperty: can not be async, use set(undefined)
    },
  );
};

/** override extra data in origObject. the original object unchanged */
export const overrideStorageObject = async (
  extra: object,
  origObject: Record<string | symbol, any>,
) => {
  const {
    storage,
    extra: origExtra,
    namespace,
    rootCtx,
  } = await origObject[ORIG_TARGET];
  return wrapScopedStorageObject(
    storage,
    { ...origExtra, ...extra },
    namespace,
    rootCtx,
  );
};
