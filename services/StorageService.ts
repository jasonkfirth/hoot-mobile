/*
    Project: Hoot Mobile
    -------------------

    File: StorageService.ts

    Purpose:

        Persist Lotide context and saved account records.

    Responsibilities:

        - Read and write the active context
        - Maintain keyed account storage
        - Support account removal and logout persistence

    This file intentionally does NOT contain:

        - network requests
        - Redux reducers
*/

import AsyncStorage from "@react-native-async-storage/async-storage";

/* ------------------------------------------------------------------------- */
/* JSON Storage Helpers                                                      */
/* ------------------------------------------------------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonRecord(path: string): Promise<Record<string, unknown>> {
  const storeStr = await AsyncStorage.getItem(path);
  if (storeStr === null) return {};

  try {
    const parsed = JSON.parse(storeStr) as unknown;
    if (isRecord(parsed)) {
      return parsed;
    }
  } catch {
    /*
        Mobile storage is long-lived and can outlast several app versions.

        If a value is corrupt, deleting that one value lets the app recover to
        a clean signed-out state instead of crashing during startup forever.
    */
  }

  await AsyncStorage.removeItem(path);
  return {};
}

function asLotideContext(value: unknown): LotideContext | undefined {
  return isRecord(value) ? (value as LotideContext) : undefined;
}

function asLotideContextStore(
  value: Record<string, unknown>,
): { [key: string]: LotideContext } {
  const out: { [key: string]: LotideContext } = {};

  Object.entries(value).forEach(([key, ctx]) => {
    if (isRecord(ctx)) {
      out[key] = ctx as LotideContext;
    }
  });

  return out;
}

/* ------------------------------------------------------------------------- */
/* Active Context Storage                                                    */
/* ------------------------------------------------------------------------- */

export const lotideContext = {
  async store(ctx: LotideContext) {
    return AsyncStorage.setItem("@lotide_ctx", JSON.stringify(ctx));
  },
  async remove() {
    return AsyncStorage.removeItem("@lotide_ctx");
  },
  async query(): Promise<LotideContext | undefined> {
    const ctx = await readJsonRecord("@lotide_ctx");
    return Object.keys(ctx).length > 0 ? (ctx as LotideContext) : undefined;
  },
};

/* ------------------------------------------------------------------------- */
/* Saved Account Storage                                                     */
/* ------------------------------------------------------------------------- */

export const lotideContextKV = {
  async store(ctx: LotideContext) {
    if (!ctx.login?.user) return;
    const name = `${ctx.login.user.username}@${ctx.apiUrl}`;
    return serviceKV.store("@lotide_ctx_arr", name, ctx);
  },
  async query(k: string): Promise<LotideContext | undefined> {
    return serviceKV.query<LotideContext>("@lotide_ctx_arr", k);
  },
  async listKeys(): Promise<string[]> {
    return serviceKV.listKeys("@lotide_ctx_arr");
  },
  async remove(k: string): Promise<LotideContext | undefined> {
    return serviceKV.remove("@lotide_ctx_arr", k);
  },
  async logout(ctx: LotideContext) {
    if (!ctx.login?.user) return;
    const name = `${ctx.login.user.username}@${ctx.apiUrl}`;
    return serviceKV.store("@lotide_ctx_arr", name, { apiUrl: ctx.apiUrl });
  },
  async getStore(): Promise<{ [key: string]: LotideContext }> {
    return asLotideContextStore(await readJsonRecord("@lotide_ctx_arr"));
  },
};

/* ------------------------------------------------------------------------- */
/* Generic Key-Value Storage                                                 */
/* ------------------------------------------------------------------------- */

const serviceKV = {
  async store<T>(path: string, k: string, v: T) {
    const store = await readJsonRecord(path);
    store[k] = v;
    await AsyncStorage.setItem(path, JSON.stringify(store));
  },

  async query<T>(path: string, k: string): Promise<T | undefined> {
    const store = await readJsonRecord(path);
    return asLotideContext(store[k]) as T | undefined;
  },

  async listKeys(path: string): Promise<string[]> {
    const store = await readJsonRecord(path);
    return Object.keys(store);
  },

  async remove<T>(path: string, k: string): Promise<T | undefined> {
    const store = await readJsonRecord(path);
    const v = asLotideContext(store[k]) as T | undefined;
    delete store[k];
    await AsyncStorage.setItem(path, JSON.stringify(store));
    return v;
  },
};

/* end of StorageService.ts */
