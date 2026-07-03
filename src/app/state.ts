import { DEFAULT_RULES } from '../constants';
import { storageGet } from '../platform/storage';
import type { HighlightRule } from '../types';
import type { SteamBanLookup } from '../steam/ban-lookup';

/**
 * App-level shared state, kept at the leaf tier (imports only constants + storage)
 * so that feed/highlight/cbl/profile modules can read it without importing the
 * lifecycle orchestrator in app/routing — which is what breaks the apparent
 * highlight ↔ routing and feed ↔ main import cycles.
 */

// --- Settings providers (read live from storage on each call) ---------------

export function getHighlightRules(): HighlightRule[] {
  const r = storageGet<HighlightRule[]>('highlightRules', DEFAULT_RULES);
  return Array.isArray(r) ? r : DEFAULT_RULES;
}

export function getPlayerFilter(): string {
  return String(storageGet('playerFilter', '') || '');
}

export function getFeedFilter(): string {
  return String(storageGet('feedFilter', '') || '');
}

export function getColorRowsByBmFlags(): boolean {
  return storageGet<boolean>('colorRowsByBmFlags', true) !== false;
}

// --- Shared Steam ban lookup singleton --------------------------------------
// Constructed/torn down by app/routing over the dashboard lifecycle; read by
// highlight/rules. Stored here (not in routing) so highlight/rules never has to
// import routing. Returns the live instance so getSnapshot()'s enqueue still fires.

let steamBanLookupInstance: SteamBanLookup | null = null;

export function getSteamBanLookup(): SteamBanLookup | null {
  return steamBanLookupInstance;
}

export function setSteamBanLookup(instance: SteamBanLookup | null): void {
  steamBanLookupInstance = instance;
}
