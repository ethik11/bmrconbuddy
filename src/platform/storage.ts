import { GM_getValue, GM_setValue } from '$';
import { STORAGE_PREFIX } from '../constants';

/** Persisted settings/cache via Greasemonkey storage (all keys share STORAGE_PREFIX). */

export function storageGet<T>(key: string, defaultValue: T): T {
  const v = GM_getValue(STORAGE_PREFIX + key, undefined) as T | undefined;
  return v === undefined ? defaultValue : v;
}

export function storageSet(key: string, value: unknown): void {
  GM_setValue(STORAGE_PREFIX + key, value);
}
