/**
 * In-memory Greasemonkey API used as the `$` module during Vitest runs
 * (aliased in vitest.config.ts). Only the surface the source imports is
 * implemented; extend as the tested modules grow.
 */

const store = new Map<string, unknown>();

export function GM_getValue<T>(key: string, defaultValue?: T): T | undefined {
  return store.has(key) ? (store.get(key) as T) : defaultValue;
}

export function GM_setValue(key: string, value: unknown): void {
  store.set(key, value);
}

export function GM_setClipboard(_data: string, _type?: string): void {
  /* no-op in tests */
}

export function GM_xmlhttpRequest(_details: unknown): void {
  /* no-op in tests; service tests override via vi.mock('$') */
}

/** Test helper: clear persisted values between tests. */
export function __resetGmStore(): void {
  store.clear();
}
