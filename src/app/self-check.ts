import { extractSteamId64FromProfileIdentifiers, findProfilePageH1 } from '../profile/identifiers';

/**
 * Loud diagnostics for markup drift.
 *
 * Battlemetrics ships generated emotion class names and reshapes its DOM from time
 * to time; when our stable hooks vanish, features just silently stop working. This
 * logs a namespaced `console.warn` (once per issue) a few seconds after a route
 * activates — long enough for the SPA to render, so a missing hook is a real signal
 * rather than a load-timing race.
 */

const NS = '[BM RCON Buddy]';
const SETTLE_MS = 4000;

const warned = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(NS, message);
}

function checkServer(): void {
  const noRows = document.querySelectorAll('div[data-session]').length === 0;
  const noFeed = document.querySelectorAll('time').length === 0;
  // Both absent means the dashboard didn't render our hooks at all. An empty server
  // still has a live feed with timestamps, so this won't fire just because nobody is
  // connected — only when the markup itself changed.
  if (noRows && noFeed) {
    warnOnce(
      'server-hooks-missing',
      'No player rows (div[data-session]) or feed timestamps found on the server dashboard — Battlemetrics may have changed its markup; player-list and feed features are inactive.',
    );
  }
}

function checkProfile(): void {
  if (!findProfilePageH1()) {
    warnOnce(
      'profile-h1-missing',
      'Profile heading (h1) not found — the header CBL chip and Copy/Note UI cannot mount (markup may have changed).',
    );
    return;
  }
  if (!extractSteamId64FromProfileIdentifiers()) {
    warnOnce(
      'profile-steamid-missing',
      'Could not read a SteamID64 from the profile identifiers — the CBL chip cannot mount (identifiers markup may have changed).',
    );
  }
}

/** Schedule a one-shot hook check for the active route (replaces any pending check). */
export function scheduleSelfCheck(kind: 'server' | 'profile'): void {
  cancelSelfCheck();
  timer = setTimeout(() => {
    timer = null;
    if (kind === 'server') checkServer();
    else checkProfile();
  }, SETTLE_MS);
}

export function cancelSelfCheck(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
