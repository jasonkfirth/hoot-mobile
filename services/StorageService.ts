/*
    Project: Hoot Mobile
    -------------------

    File: StorageService.ts

    Purpose:

        Persist Lotide context, saved account records, and app settings.

    Responsibilities:

        - Read and write the active context
        - Maintain keyed account storage
        - Support account removal and logout persistence
        - Keep small app preferences defensively parsed

    This file intentionally does NOT contain:

        - network requests
        - Redux reducers
*/

import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeLotideApiUrl } from "./LotideService/util";

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
  return isRecord(value) ? normalizeLotideContext(value as LotideContext) : undefined;
}

function asLotideContextStore(
  value: Record<string, unknown>,
): { [key: string]: LotideContext } {
  const out: { [key: string]: LotideContext } = {};

  Object.entries(value).forEach(([key, ctx]) => {
    const context = asLotideContext(ctx);
    if (!context) return;

    const normalizedKey = accountStoreKeyForContext(context) ??
      normalizeAccountStoreKey(key);

    /*
        Old stores can contain both locked and unlocked copies of the same
        account under cosmetically different API URLs. Prefer the unlocked copy
        when entries collapse to the same canonical key.
    */
    if (out[normalizedKey]?.login && !context.login) return;

    out[normalizedKey] = context;
  });

  return out;
}

function normalizeLotideContext(ctx: LotideContext): LotideContext {
  if (!ctx.apiUrl) return ctx;

  const apiUrl = normalizeLotideApiUrl(ctx.apiUrl);
  return apiUrl === ctx.apiUrl ? ctx : { ...ctx, apiUrl };
}

function accountStoreKeyForContext(ctx: LotideContext): string | undefined {
  if (!ctx.apiUrl || !ctx.login?.user?.username) return undefined;

  return `${ctx.login.user.username}@${normalizeLotideApiUrl(ctx.apiUrl)}`;
}

function normalizeAccountStoreKey(key: string): string {
  const separator = key.indexOf("@");
  if (separator < 0) return key;

  const username = key.slice(0, separator);
  const apiUrl = key.slice(separator + 1);

  if (!username || !apiUrl) return key;

  return `${username}@${normalizeLotideApiUrl(apiUrl)}`;
}

async function writeLotideContextStore(
  store: { [key: string]: LotideContext },
): Promise<void> {
  await AsyncStorage.setItem("@lotide_ctx_arr", JSON.stringify(store));
}

function asSortOption(value: unknown): SortOption | undefined {
  if (value === "hot" || value === "new" || value === "top") {
    return value;
  }

  return undefined;
}

/* ------------------------------------------------------------------------- */
/* Active Context Storage                                                    */
/* ------------------------------------------------------------------------- */

export const lotideContext = {
  async store(ctx: LotideContext) {
    return AsyncStorage.setItem(
      "@lotide_ctx",
      JSON.stringify(normalizeLotideContext(ctx)),
    );
  },
  async remove() {
    return AsyncStorage.removeItem("@lotide_ctx");
  },
  async query(): Promise<LotideContext | undefined> {
    const ctx = await readJsonRecord("@lotide_ctx");
    return Object.keys(ctx).length > 0
      ? normalizeLotideContext(ctx as LotideContext)
      : undefined;
  },
};

/* ------------------------------------------------------------------------- */
/* Saved Account Storage                                                     */
/* ------------------------------------------------------------------------- */

export const lotideContextKV = {
  async store(ctx: LotideContext) {
    const normalizedCtx = normalizeLotideContext(ctx);
    const name = accountStoreKeyForContext(normalizedCtx);
    if (!name) return;

    const store = asLotideContextStore(await readJsonRecord("@lotide_ctx_arr"));
    store[name] = normalizedCtx;
    await writeLotideContextStore(store);
  },
  async query(k: string): Promise<LotideContext | undefined> {
    const store = asLotideContextStore(await readJsonRecord("@lotide_ctx_arr"));
    return store[normalizeAccountStoreKey(k)];
  },
  async listKeys(): Promise<string[]> {
    return Object.keys(asLotideContextStore(await readJsonRecord("@lotide_ctx_arr")));
  },
  async remove(k: string): Promise<LotideContext | undefined> {
    const normalizedKey = normalizeAccountStoreKey(k);
    const rawStore = await readJsonRecord("@lotide_ctx_arr");
    const store = asLotideContextStore(rawStore);
    const removed = store[normalizedKey];

    Object.keys(rawStore).forEach(key => {
      if (normalizeAccountStoreKey(key) === normalizedKey) {
        delete rawStore[key];
      }
    });
    delete store[normalizedKey];

    await writeLotideContextStore(asLotideContextStore(rawStore));
    return removed;
  },
  async logout(ctx: LotideContext) {
    const normalizedCtx = normalizeLotideContext(ctx);
    const name = accountStoreKeyForContext(normalizedCtx);
    if (!name) return;

    const store = asLotideContextStore(await readJsonRecord("@lotide_ctx_arr"));
    store[name] = { apiUrl: normalizedCtx.apiUrl };
    await writeLotideContextStore(store);
  },
  async getStore(): Promise<{ [key: string]: LotideContext }> {
    return asLotideContextStore(await readJsonRecord("@lotide_ctx_arr"));
  },
};

/* ------------------------------------------------------------------------- */
/* App Settings Storage                                                      */
/* ------------------------------------------------------------------------- */

export type AppSettings = {
  defaultFeedSort: SortOption;
};

const defaultAppSettings: AppSettings = {
  defaultFeedSort: "hot",
};

function normalizeAppSettings(value: Record<string, unknown>): AppSettings {
  return {
    defaultFeedSort:
      asSortOption(value.defaultFeedSort) ??
      defaultAppSettings.defaultFeedSort,
  };
}

export const appSettings = {
  defaults: defaultAppSettings,

  async store(settings: AppSettings) {
    await AsyncStorage.setItem("@hoot_app_settings", JSON.stringify(settings));
  },

  async query(): Promise<AppSettings> {
    return normalizeAppSettings(await readJsonRecord("@hoot_app_settings"));
  },

  async update(settings: Partial<AppSettings>): Promise<AppSettings> {
    const current = await appSettings.query();
    const next = normalizeAppSettings({
      ...current,
      ...settings,
    });

    await appSettings.store(next);
    return next;
  },
};

/* end of StorageService.ts */
