import { storageGet, storageSet } from '../platform/storage';
import { CblGraphqlClient, mapCblResponse } from './graphql';
import type { CblPayload, CblWaiter } from '../types';

/**
 * Per-SteamID64 CBL reputation cache with TTL + a deduped, rate-limited queue.
 * Ported from the constructor-function in the monolith.
 */

interface CblCacheEntry {
  fetchedAt: number;
  payload: CblPayload;
}

export class CblReputationService {
  private cache: Record<string, CblCacheEntry> = Object.create(null);
  private queue: string[] = [];
  private running = false;
  private readonly ttlMs: number;
  private readonly minIntervalMs: number;
  private lastFetchAt = 0;
  private waiters: Record<string, CblWaiter[]> = Object.create(null);
  private queued: Record<string, boolean> = Object.create(null);
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.ttlMs = Number(storageGet('cblTtlHours', 12)) * 3600000 || 43200000;
    this.minIntervalMs = Number(storageGet('cblMinIntervalMs', 200)) || 200;
  }

  loadCache(): void {
    const raw = storageGet<Record<string, CblCacheEntry> | null>('cblCache', null);
    if (!raw || typeof raw !== 'object') return;
    this.cache = raw;
  }

  private persistCache(): void {
    storageSet('cblCache', this.cache);
  }

  private persistCacheSoon(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistCache();
    }, 350);
  }

  getCached(steamId64: string): CblPayload | null {
    const e = this.cache[steamId64];
    if (!e || !e.fetchedAt) return null;
    if (Date.now() - e.fetchedAt > this.ttlMs) return null;
    return e.payload;
  }

  private shouldCachePayload(payload: CblPayload): boolean {
    return payload && (payload.kind === 'ok' || payload.kind === 'notFound');
  }

  private setCached(steamId64: string, payload: CblPayload): void {
    this.cache[steamId64] = { fetchedAt: Date.now(), payload };
    this.persistCacheSoon();
  }

  private flushWaiters(steamId64: string, err: unknown, data: CblPayload | null): void {
    const list = this.waiters[steamId64];
    delete this.waiters[steamId64];
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      try {
        list[i](err, data);
      } catch {}
    }
  }

  enqueue(steamId64: string, cb: CblWaiter): void {
    const cached = this.getCached(steamId64);
    if (cached !== null) {
      try {
        cb(null, cached);
      } catch {}
      return;
    }

    if (!this.waiters[steamId64]) this.waiters[steamId64] = [];
    this.waiters[steamId64].push(cb);

    if (this.queued[steamId64]) return;
    this.queued[steamId64] = true;
    this.queue.push(steamId64);
    this.pump();
  }

  private pump(): void {
    if (this.running) return;
    this.running = true;

    const step = (): void => {
      if (!this.queue.length) {
        this.running = false;
        return;
      }
      const steamId64 = this.queue.shift() as string;
      const cached = this.getCached(steamId64);
      if (cached !== null) {
        delete this.queued[steamId64];
        this.flushWaiters(steamId64, null, cached);
        setTimeout(step, 0);
        return;
      }

      let wait = this.minIntervalMs - (Date.now() - this.lastFetchAt);
      if (wait < 0) wait = 0;
      setTimeout(() => {
        CblGraphqlClient.fetchSteamUser(steamId64)
          .then((json) => {
            this.lastFetchAt = Date.now();
            const mapped = mapCblResponse(json);
            if (this.shouldCachePayload(mapped)) this.setCached(steamId64, mapped);
            delete this.queued[steamId64];
            this.flushWaiters(steamId64, null, mapped);
          })
          .catch((err) => {
            this.lastFetchAt = Date.now();
            delete this.queued[steamId64];
            this.flushWaiters(steamId64, err, null);
          })
          .then(() => {
            step();
          });
      }, wait);
    };

    step();
  }
}

// The standalone player-profile route has no server dashboard, so it uses its own
// lazily-created CBL service. Co-located with the class (instead of app/state) to
// keep app/state free of the heavy service import.
let profilePageInstance: CblReputationService | null = null;

export function ensureProfilePageCblService(): CblReputationService {
  if (!profilePageInstance) {
    profilePageInstance = new CblReputationService();
    profilePageInstance.loadCache();
  }
  return profilePageInstance;
}
