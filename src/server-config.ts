/**
 * Single source of truth for Battlemetrics RCON matching and known-server accents.
 *
 * Both the userscript `@match` header (built in vite.config.ts) and the runtime SPA
 * route check (app/routing.ts) derive from MATCH_PATTERNS / MATCHED_SERVER_PATH_RE.
 * Known Northern Lights ids live here so identity chrome stays in sync with matching.
 *
 * This module MUST stay free of DOM / GM (`$`) imports: vite.config.ts imports it at
 * build time, where those globals do not exist.
 */

/** `@match` patterns for the generated userscript banner. */
export const MATCH_PATTERNS: string[] = [
  'https://www.battlemetrics.com/rcon/servers/*',
  'https://www.battlemetrics.com/rcon/players/*',
];

/**
 * Matches any numeric server-dashboard path (`/rcon/servers/123`). Does not match
 * `/rcon/servers` with no id.
 */
export const MATCHED_SERVER_PATH_RE = /\/rcon\/servers\/(\d+)/;

/** Accent used when the dashboard id is not in {@link KNOWN_SERVERS}. */
export const DEFAULT_SERVER_ACCENT = '#64748b';

export interface KnownServerIdentity {
  label: string;
  accent: string;
}

/** Named identity chrome for community servers we care about at a glance. */
export const KNOWN_SERVERS: Readonly<Record<string, KnownServerIdentity>> = {
  '34935347': { label: 'NL #1', accent: '#2dd4bf' },
  '40375266': { label: 'NL #2', accent: '#fbbf24' },
};

export interface ServerIdentityLook {
  /** Named pill text; `null` means bar-only (unknown server). */
  label: string | null;
  accent: string;
}

/** Extract the numeric Battlemetrics server id from a pathname, if present. */
export function parseServerIdFromPath(path: string): string | null {
  const m = path.match(MATCHED_SERVER_PATH_RE);
  return m ? m[1] : null;
}

/** Resolve the left-bar accent and optional named pill for a server id. */
export function lookupServerIdentity(serverId: string): ServerIdentityLook {
  const known = KNOWN_SERVERS[serverId];
  if (known) return { label: known.label, accent: known.accent };
  return { label: null, accent: DEFAULT_SERVER_ACCENT };
}
