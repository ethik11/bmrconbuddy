import {
  SERVER_ACCENT_CLASS,
  SERVER_ACCENT_VAR,
  SERVER_H1_WITH_PILL_CLASS,
  SERVER_IDENTITY_ATTR,
  SERVER_PILL_CLASS,
} from '../constants';
import { lookupServerIdentity, parseServerIdFromPath } from '../server-config';

/**
 * Per-server identity chrome: a 4px left accent bar on every dashboard, plus a
 * named pill (NL #1 / NL #2) next to the H1 for known Northern Lights servers.
 * Feed phrase colors are unchanged — this is glanceable tab identity only.
 */

const PILL_RETRY_MS = 400;

let pillRetryTimer: ReturnType<typeof setTimeout> | null = null;

function cancelPillRetry(): void {
  if (pillRetryTimer) {
    clearTimeout(pillRetryTimer);
    pillRetryTimer = null;
  }
}

function findDashboardH1(): HTMLHeadingElement | null {
  const h1 = document.querySelector<HTMLHeadingElement>('h1');
  if (!h1) return null;
  // Profile headings contain a player link; the server dashboard title does not.
  if (h1.querySelector('a[href*="/rcon/players/"]')) return null;
  return h1;
}

function removePills(): void {
  const pills = document.querySelectorAll('[' + SERVER_IDENTITY_ATTR + ']');
  for (let i = 0; i < pills.length; i++) {
    const par = pills[i].parentElement;
    pills[i].remove();
    if (par && par.tagName === 'H1') {
      par.classList.remove(SERVER_H1_WITH_PILL_CLASS);
    }
  }
}

function mountKnownServerPill(serverId: string, label: string): boolean {
  const h1 = findDashboardH1();
  if (!h1) return false;

  const pill = document.createElement('span');
  pill.setAttribute(SERVER_IDENTITY_ATTR, serverId);
  pill.className = SERVER_PILL_CLASS;
  pill.textContent = label;
  h1.classList.add(SERVER_H1_WITH_PILL_CLASS);
  h1.insertBefore(pill, h1.firstChild);
  return true;
}

/** Paint the left bar (always) and named pill (known servers only). */
export function applyServerIdentity(path: string = location.pathname): void {
  cancelPillRetry();

  const serverId = parseServerIdFromPath(path);
  if (!serverId) {
    clearServerIdentity();
    return;
  }

  const ident = lookupServerIdentity(serverId);
  const root = document.documentElement;
  root.style.setProperty(SERVER_ACCENT_VAR, ident.accent);
  root.classList.add(SERVER_ACCENT_CLASS);

  removePills();
  if (!ident.label) return;

  if (mountKnownServerPill(serverId, ident.label)) return;

  pillRetryTimer = setTimeout(() => {
    pillRetryTimer = null;
    if (parseServerIdFromPath(location.pathname) !== serverId) return;
    if (document.querySelector('[' + SERVER_IDENTITY_ATTR + ']')) return;
    const again = lookupServerIdentity(serverId);
    if (again.label) mountKnownServerPill(serverId, again.label);
  }, PILL_RETRY_MS);
}

/** Strip the accent bar, CSS variable, and any injected pills. */
export function clearServerIdentity(): void {
  cancelPillRetry();
  const root = document.documentElement;
  root.style.removeProperty(SERVER_ACCENT_VAR);
  root.classList.remove(SERVER_ACCENT_CLASS);
  removePills();
}
