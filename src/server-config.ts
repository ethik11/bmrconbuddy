/**
 * Single source of truth for the Battlemetrics server this script targets.
 *
 * Both the userscript `@match` header (built in vite.config.ts) and the runtime SPA
 * route check (app/routing.ts) derive from SERVER_ID. To retarget another server,
 * change it in ONE place here and rebuild — the header and the route guard stay in sync.
 *
 * This module MUST stay free of DOM / GM (`$`) imports: vite.config.ts imports it at
 * build time, where those globals do not exist.
 */
const SERVER_ID = '34935347';

/** `@match` patterns for the generated userscript banner. */
export const MATCH_PATTERNS: string[] = [
  `https://www.battlemetrics.com/rcon/servers/${SERVER_ID}*`,
  'https://www.battlemetrics.com/rcon/players/*',
];

/** Matches the server-dashboard path; used to switch SPA routes at runtime. */
export const MATCHED_SERVER_PATH_RE = new RegExp(`/rcon/servers/${SERVER_ID}`);
