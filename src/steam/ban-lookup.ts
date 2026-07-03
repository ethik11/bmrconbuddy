import { GM_xmlhttpRequest } from '$';
import { storageGet, storageSet } from '../platform/storage';
import type { SteamBanSnapshot } from '../types';

/**
 * Optional red row tint when a Steam Web API key is stored and the player has a
 * VAC/game ban. Queue + cache + rate-limit; a failed lookup is cached as `false`
 * for 24h on purpose (avoids hammering the API on errors).
 */

interface SteamBanCacheEntry {
  fetchedAt: number;
  vacOrGameBan: boolean;
}

export class SteamBanLookup {
  private cache: Record<string, SteamBanCacheEntry> = Object.create(null);
  private queue: string[] = [];
  private inFlight: Record<string, boolean> = Object.create(null);
  private running = false;
  private lastFetchAt = 0;
  private readonly minIntervalMs = 350;
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;

  /** Called (debounced) when a lookup resolves; wired to refresh row visuals. */
  onUpdate: (() => void) | null = null;

  constructor() {
    this.loadCache();
  }

  loadCache(): void {
    const raw = storageGet<Record<string, SteamBanCacheEntry> | null>('steamBanCache', null);
    if (raw && typeof raw === 'object') this.cache = raw;
  }

  private persistCache(): void {
    storageSet('steamBanCache', this.cache);
  }

  private apiKey(): string {
    return String(storageGet('steamWebApiKey', '') || '').trim();
  }

  private cacheTtlMs(): number {
    return 24 * 3600000;
  }

  /** `null` = Steam lookup disabled (no API key). */
  getSnapshot(steamId64: string): SteamBanSnapshot | null {
    if (!this.apiKey()) return null;
    const e = this.cache[steamId64];
    if (e && Date.now() - e.fetchedAt <= this.cacheTtlMs()) {
      return { loading: false, vacOrGameBan: !!e.vacOrGameBan };
    }
    this.enqueue(steamId64);
    return { loading: true, vacOrGameBan: false };
  }

  enqueue(steamId64: string): void {
    if (!this.apiKey()) return;
    if (this.inFlight[steamId64]) return;
    if (this.queue.indexOf(steamId64) !== -1) return;
    this.queue.push(steamId64);
    this.pump();
  }

  private scheduleNotify(): void {
    if (this.notifyTimer) clearTimeout(this.notifyTimer);
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      if (typeof this.onUpdate === 'function') this.onUpdate();
    }, 40);
  }

  private pump(): void {
    if (this.running) return;
    this.running = true;

    const step = (): void => {
      if (!this.queue.length) {
        this.running = false;
        return;
      }
      const key = this.apiKey();
      if (!key) {
        this.queue.length = 0;
        this.running = false;
        return;
      }
      const id = this.queue.shift() as string;

      let wait = this.minIntervalMs - (Date.now() - this.lastFetchAt);
      if (wait < 0) wait = 0;

      setTimeout(() => {
        this.inFlight[id] = true;
        const url =
          'https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=' +
          encodeURIComponent(key) +
          '&steamids=' +
          encodeURIComponent(id);
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          onload: (r) => {
            delete this.inFlight[id];
            this.lastFetchAt = Date.now();
            let vacOrGameBan = false;
            try {
              const j = JSON.parse(r.responseText || '{}');
              const p = j.players && j.players[0];
              if (p) {
                vacOrGameBan = !!p.VACBanned || (Number(p.NumberOfGameBans) || 0) > 0;
              }
            } catch {
              vacOrGameBan = false;
            }
            this.cache[id] = { fetchedAt: Date.now(), vacOrGameBan };
            this.persistCache();
            this.scheduleNotify();
            setTimeout(step, 0);
          },
          onerror: () => {
            delete this.inFlight[id];
            this.lastFetchAt = Date.now();
            this.cache[id] = { fetchedAt: Date.now(), vacOrGameBan: false };
            this.persistCache();
            this.scheduleNotify();
            setTimeout(step, 0);
          },
          ontimeout: () => {
            delete this.inFlight[id];
            this.lastFetchAt = Date.now();
            this.cache[id] = { fetchedAt: Date.now(), vacOrGameBan: false };
            this.persistCache();
            this.scheduleNotify();
            setTimeout(step, 0);
          },
          timeout: 20000,
        });
      }, wait);
    };

    step();
  }
}
