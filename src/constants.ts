import type { HighlightRule } from './types';

/**
 * Cross-cutting constants: storage prefix, the `data-bss-*` DOM markers, id
 * regexes, CBL endpoints, and built-in rules.
 *
 * Every `data-bss-*` attribute name lives here on purpose — the whole toolkit
 * relies on these markers as cross-invocation memory, so two modules must never
 * define the same literal independently (drift would cause duplicate injection).
 */

export const STORAGE_PREFIX = 'bssToolkit.v1.';

// --- DOM markers ------------------------------------------------------------
export const PROCESSED_ATTR = 'data-bss-processed'; // player row handled
export const FEED_PROCESSED_ATTR = 'data-bss-feed-processed'; // feed line handled
export const TS_TITLE_ATTR = 'data-bss-ts-title'; // datetime used for the timestamp tooltip
export const ADMIN_TAG_NAME_MARK_ATTR = 'data-bss-admin-tag-name'; // name recolored
export const CBL_FOR_ATTR = 'data-bss-cbl-for'; // chip present for steamId
export const CBL_PENDING_ATTR = 'data-bss-cbl-pending'; // profile header chip in flight
export const PROFILE_HEADER_CBL_ATTR = 'data-bss-profile-header-cbl';
export const PROFILE_PATH_ATTR = 'data-bss-profile-path';
export const PROFILE_OVERVIEW_ACTIONS_ATTR = 'data-bss-profile-overview-actions';
export const SERVER_IDENTITY_ATTR = 'data-bss-server-identity'; // NL #1 / NL #2 header pill

// --- CSS class names --------------------------------------------------------
export const ADMIN_TAG_NAME_CLASS = 'bss-toolkit-admin-tag-name';
export const ADMIN_TAG_NAME_COLOR = '#00fff7';
export const RULE_HIDDEN_CLASS = 'bss-toolkit-rule-hidden';
export const SERVER_ACCENT_CLASS = 'bss-toolkit-has-server-accent';
export const SERVER_PILL_CLASS = 'bss-toolkit-server-pill';
export const SERVER_H1_WITH_PILL_CLASS = 'bss-toolkit-server-h1-with-pill';
export const SERVER_ACCENT_VAR = '--bss-server-accent';

/** Row classes for Battlemetrics-derived row tint (cleared before re-apply). */
export const BM_FLAG_ROW_CLASSES = [
  'bss-toolkit-bmflag-admin',
  'bss-toolkit-bmflag-problem',
  'bss-toolkit-bmflag-sus',
  'bss-toolkit-bmflag-steam-ban',
];

// --- Identifier regexes -----------------------------------------------------
export const STEAM_ID64_RE = /^7656119\d{10}$/;
export const EOS_ID_RE = /^[0-9a-f]{32}$/i;

export const PROFILE_TAB_LABEL_RE =
  /^(Overview|Identifiers|Flags|Activity|Sessions|Related Players)$/i;

// --- Community Ban List -----------------------------------------------------
export const CBL_GRAPHQL_URL = 'https://communitybanlist.com/graphql';

export function cblSearchUrl(steamId64: string): string {
  return 'https://communitybanlist.com/search/' + encodeURIComponent(steamId64);
}

/** Built-in feed highlight rules (warn / trigger / kick left-border tints). */
export const DEFAULT_RULES: HighlightRule[] = [
  {
    id: 'feed-remote-warn',
    enabled: true,
    feedLineMatches: 'Remote admin has warned',
    actions: [{ type: 'setRowClass', className: 'bss-toolkit-feed-warn' }],
  },
  {
    id: 'feed-trigger',
    enabled: true,
    feedLineMatches: 'by Trigger',
    actions: [{ type: 'setRowClass', className: 'bss-toolkit-feed-trigger' }],
  },
  {
    id: 'feed-kick',
    enabled: true,
    feedLineMatches: 'was kicked',
    actions: [{ type: 'setRowClass', className: 'bss-toolkit-feed-kick' }],
  },
];
