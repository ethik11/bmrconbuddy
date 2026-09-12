import { ADMIN_TAG_NAME_COLOR } from '../constants';

/**
 * Named color tokens for feed lines, highlight rules, admin-tag names, and BM-flag
 * row tints. Stored values are a partial overlay on these defaults.
 */

export const THEME_KEYS = [
  'feedModAction',
  'feedAdminAction',
  'feedTeamKilled',
  'feedTeamBluefor',
  'feedTeamPac',
  'feedTeamOpfor',
  'feedTeamIndep',
  'feedTracked',
  'highlightWarn',
  'highlightTrigger',
  'highlightKick',
  'adminTagName',
  'flagAdmin',
  'flagProblem',
  'flagSus',
  'flagSteamBan',
] as const;

export type ThemeKey = (typeof THEME_KEYS)[number];
export type ThemeSettings = Record<ThemeKey, string>;

export const THEME_CSS_VARS: Record<ThemeKey, string> = {
  feedModAction: '--bss-feed-mod',
  feedAdminAction: '--bss-feed-admin',
  feedTeamKilled: '--bss-feed-tk',
  feedTeamBluefor: '--bss-feed-bluefor',
  feedTeamPac: '--bss-feed-pac',
  feedTeamOpfor: '--bss-feed-opfor',
  feedTeamIndep: '--bss-feed-indep',
  feedTracked: '--bss-feed-tracked',
  highlightWarn: '--bss-hl-warn',
  highlightTrigger: '--bss-hl-trigger',
  highlightKick: '--bss-hl-kick',
  adminTagName: '--bss-admin-tag',
  flagAdmin: '--bss-flag-admin',
  flagProblem: '--bss-flag-problem',
  flagSus: '--bss-flag-sus',
  flagSteamBan: '--bss-flag-steam-ban',
};

export const DEFAULT_THEME: ThemeSettings = {
  feedModAction: '#ff3333',
  feedAdminAction: '#37ff00',
  feedTeamKilled: '#ffcc00',
  feedTeamBluefor: '#e7a600',
  feedTeamPac: '#34804d',
  feedTeamOpfor: '#d95627',
  feedTeamIndep: '#eaff00',
  feedTracked: '#919191',
  highlightWarn: '#e6b422',
  highlightTrigger: '#c96bdd',
  highlightKick: '#e05252',
  adminTagName: ADMIN_TAG_NAME_COLOR,
  flagAdmin: '#e91eac',
  flagProblem: '#dc2626',
  flagSus: '#e67e22',
  flagSteamBan: '#dc2626',
};

export const THEME_FIELD_GROUPS: { title: string; fields: { key: ThemeKey; label: string }[] }[] = [
  {
    title: 'Feed',
    fields: [
      { key: 'feedModAction', label: 'Warn / kick / ban' },
      { key: 'feedAdminAction', label: 'Admin actions' },
      { key: 'feedTeamKilled', label: 'Team kill' },
      { key: 'feedTeamBluefor', label: 'BLUFOR teams' },
      { key: 'feedTeamPac', label: 'PAC teams' },
      { key: 'feedTeamOpfor', label: 'OPFOR teams' },
      { key: 'feedTeamIndep', label: 'Independent teams' },
      { key: 'feedTracked', label: 'Auto-kick / spam' },
    ],
  },
  {
    title: 'Highlights',
    fields: [
      { key: 'highlightWarn', label: 'Warn rule' },
      { key: 'highlightTrigger', label: 'Trigger rule' },
      { key: 'highlightKick', label: 'Kick rule' },
    ],
  },
  {
    title: 'Players',
    fields: [
      { key: 'adminTagName', label: 'Admin-tag name' },
      { key: 'flagAdmin', label: 'Admin flag tint' },
      { key: 'flagProblem', label: 'Problem Player tint' },
      { key: 'flagSus', label: 'Sus flag tint' },
      { key: 'flagSteamBan', label: 'VAC / game-ban tint' },
    ],
  },
];

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Expand #rgb → #rrggbb and lowercase. Null when the value is not a hex color. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!HEX_RE.test(v)) return null;
  if (v.length === 4) {
    return ('#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]).toLowerCase();
  }
  return v.toLowerCase();
}

/** Overlay a partial stored theme on the built-in defaults (invalid keys/values dropped). */
export function mergeTheme(partial: unknown): ThemeSettings {
  const next: ThemeSettings = { ...DEFAULT_THEME };
  if (!partial || typeof partial !== 'object' || Array.isArray(partial)) return next;
  const rec = partial as Record<string, unknown>;
  for (let i = 0; i < THEME_KEYS.length; i++) {
    const key = THEME_KEYS[i];
    const hex = normalizeHex(rec[key]);
    if (hex) next[key] = hex;
  }
  return next;
}

/** Write the live theme as CSS custom properties on `:root` (or `root`). */
export function applyThemeCssVars(
  theme: ThemeSettings,
  root: HTMLElement = document.documentElement,
): void {
  for (let i = 0; i < THEME_KEYS.length; i++) {
    const key = THEME_KEYS[i];
    root.style.setProperty(THEME_CSS_VARS[key], theme[key]);
  }
}

/** `:root { --bss-*: default }` so injected CSS has fallbacks before applyThemeCssVars. */
export function rootThemeCssRules(): string[] {
  const lines = [':root {'];
  for (let i = 0; i < THEME_KEYS.length; i++) {
    const key = THEME_KEYS[i];
    lines.push('  ' + THEME_CSS_VARS[key] + ': ' + DEFAULT_THEME[key] + ';');
  }
  lines.push('}');
  return lines;
}
