import { FEED_PROCESSED_ATTR, STEAM_ID64_RE } from '../constants';
import type { ParsedPlayerRow } from '../types';

/**
 * Shared DOM vocabulary: normalize text, read connected-player rows, and detect
 * feed-line structure. Player row hook: `div[data-session]`. Feed line hook:
 * a `<time>` element plus a sibling message `<div>` (server feed + profile log).
 */

export function normalizeWs(s: string | null | undefined): string {
  return (s || '').replace(/\s+/g, ' ').trim();
}

export function stripBssToolkitClassesFromElement(el: Element | null): void {
  if (!el || !el.classList) return;
  const cl = el.classList;
  for (let i = cl.length - 1; i >= 0; i--) {
    const n = cl[i];
    if (n.indexOf('bss-toolkit-') === 0) cl.remove(n);
  }
}

/** Read SteamID64 from the Platform ID column. */
export function extractSteamId64FromRow(rowEl: HTMLElement): string | null {
  const cell = rowEl.querySelector('[data-title="Platform ID"]');
  if (!cell) return null;
  const span = cell.querySelector('span[title]') || cell.querySelector('span');
  const raw = normalizeWs(
    (span && span.getAttribute('title')) || (span && span.textContent) || cell.textContent || '',
  );
  return STEAM_ID64_RE.test(raw) ? raw : null;
}

/**
 * Read BM flag titles from a player's name area. Excludes the name `<a title>`
 * and the "Play Time" `<time title>` tooltip, which would pollute search/rules.
 */
export function collectBadgeTitlesFromNameArea(nameArea: ParentNode | null): string[] {
  const badgeTitles: string[] = [];
  if (!nameArea || !nameArea.querySelectorAll) return badgeTitles;
  const badges = nameArea.querySelectorAll('svg[title], span[title]');
  for (let b = 0; b < badges.length; b++) {
    const el = badges[b];
    if (el.closest && el.closest('a[href*="/rcon/players/"]')) continue;
    const title = el.getAttribute('title');
    if (title) badgeTitles.push(title);
  }
  return badgeTitles;
}

export function parsePlayerRow(rowEl: HTMLElement): ParsedPlayerRow | null {
  if (!rowEl || !rowEl.getAttribute('data-session')) return null;
  const steamId64 = extractSteamId64FromRow(rowEl);
  if (!steamId64) return null;

  const nameArea = rowEl.querySelector('div.name');
  const nameAnchor = nameArea
    ? nameArea.querySelector('a[href*="/rcon/players/"]')
    : rowEl.querySelector('div.name a[href*="/rcon/players/"]');
  const displayName = nameAnchor ? normalizeWs(nameAnchor.textContent || '') : '';

  let roleText = '';
  const details = rowEl.querySelectorAll('div.player-detail .text-muted');
  for (let i = 0; i < details.length; i++) {
    const t = normalizeWs(details[i].textContent || '');
    if (t.indexOf('Role:') === 0) {
      roleText = t;
      break;
    }
  }

  const teamEl = rowEl.querySelector('[data-title="Team"]');
  const squadEl = rowEl.querySelector('[data-title="Squad"]');
  const teamText = teamEl ? normalizeWs(teamEl.textContent || '') : '';
  const squadText = squadEl ? normalizeWs(squadEl.textContent || '') : '';

  const badgeTitles = collectBadgeTitlesFromNameArea(nameArea);
  const hasPlayerNote =
    !!rowEl.querySelector('span.css-sq8q19') || !!rowEl.querySelector('.glyphicon-comment');

  return {
    steamId64,
    displayName,
    roleText,
    teamText,
    squadText,
    badgeTitles,
    hasPlayerNote,
    rowEl,
  };
}

/** Build a single searchable string for player filter matching. */
export function playerRowSearchBlob(p: ParsedPlayerRow): string {
  return [p.displayName, p.steamId64, p.roleText, p.teamText, p.squadText, p.badgeTitles.join(' ')]
    .join(' ')
    .toLowerCase();
}

/** Feed lines: legacy `<time><div>` siblings, or BM's `<span><time></span><div>` layout. */
export function getFeedMessageElement(lineEl: HTMLElement | null): HTMLElement | null {
  if (!lineEl) return null;
  const kids = lineEl.children;
  for (let i = 0; i < kids.length; i++) {
    if (kids[i].tagName === 'DIV' && !kids[i].querySelector('time')) return kids[i] as HTMLElement;
  }
  for (let i = 0; i < kids.length; i++) {
    if (kids[i].tagName === 'TIME') {
      const next = kids[i].nextElementSibling;
      if (next && next.tagName === 'DIV') return next as HTMLElement;
    }
  }
  return null;
}

/** Feed line shape: contains `<time>` plus a message `<div>` (structural, not a type guard). */
export function isFeedLineStructure(el: unknown): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (!el.querySelector('time')) return false;
  return !!getFeedMessageElement(el);
}

/** Walk up from a `<time>` wrapper to the activity row container. */
export function resolveFeedLineContainer(fromEl: Element | null): HTMLElement | null {
  if (!fromEl || !(fromEl instanceof HTMLElement)) return null;
  let cur: HTMLElement | null = fromEl;
  let depth = 0;
  while (cur && depth < 6) {
    if (isFeedLineStructure(cur)) return cur;
    cur = cur.parentElement;
    depth++;
  }
  return null;
}

/** Unprocessed feed line on the server dashboard (first-pass marking). */
export function isRconFeedLine(el: unknown): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.getAttribute(FEED_PROCESSED_ATTR)) return false;
  return isFeedLineStructure(el);
}

export function getFeedLineText(el: HTMLElement): string {
  const msg = getFeedMessageElement(el);
  return msg ? normalizeWs(msg.textContent || '') : '';
}
