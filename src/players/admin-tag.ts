import { ADMIN_TAG_NAME_CLASS, ADMIN_TAG_NAME_COLOR, ADMIN_TAG_NAME_MARK_ATTR } from '../constants';
import { collectBadgeTitlesFromNameArea, parsePlayerRow } from '../dom/parsing';
import type { ParsedPlayerRow } from '../types';

/**
 * Cyan (#00fff7) player name ONLY when a BM admin badge/tag is present. Applied
 * to the connected-player list name link and the profile h1 name link — never to
 * the feed/activity log (no badge context there).
 */

/** True when a badge title looks like a BM admin flag (e.g. "NL Squad Admin"). */
export function isAdminBadgeTitle(title: string | null | undefined): boolean {
  const t = (title || '').toLowerCase();
  if (t.indexOf('admin') === -1) return false;
  if (t.indexOf('regular player') !== -1) return false;
  return true;
}

export function badgeTitlesIncludeAdminTag(badgeTitles: string[]): boolean {
  for (let i = 0; i < badgeTitles.length; i++) {
    if (isAdminBadgeTitle(badgeTitles[i])) return true;
  }
  return false;
}

/** Detect a BM admin flag anywhere within a scope (e.g. a profile page). */
export function scopeHasAdminTag(scope: ParentNode | null): boolean {
  if (!scope || !scope.querySelectorAll) return false;
  const flagNodes = scope.querySelectorAll(
    '[data-testid^="flag-"][title], svg[title], span[title]',
  );
  for (let i = 0; i < flagNodes.length; i++) {
    if (isAdminBadgeTitle(flagNodes[i].getAttribute('title'))) return true;
  }
  const nameAreas = scope.querySelectorAll('div.name');
  for (let n = 0; n < nameAreas.length; n++) {
    if (badgeTitlesIncludeAdminTag(collectBadgeTitlesFromNameArea(nameAreas[n]))) return true;
  }
  return false;
}

function setAdminTagNameStyle(el: HTMLElement | null, hasAdminTag: boolean): void {
  if (!el) return;
  if (hasAdminTag) {
    el.classList.add(ADMIN_TAG_NAME_CLASS);
    el.style.color = ADMIN_TAG_NAME_COLOR;
    el.setAttribute(ADMIN_TAG_NAME_MARK_ATTR, '1');
    return;
  }
  el.classList.remove(ADMIN_TAG_NAME_CLASS);
  if (el.getAttribute(ADMIN_TAG_NAME_MARK_ATTR) === '1') {
    el.style.removeProperty('color');
    el.removeAttribute(ADMIN_TAG_NAME_MARK_ATTR);
  }
}

export const AdminTagNameStyler = {
  /** Color or clear the name link on a connected player row. */
  applyToPlayerRow(parsed: ParsedPlayerRow): void {
    const nameAnchor = parsed.rowEl.querySelector<HTMLElement>(
      'div.name a[href*="/rcon/players/"]',
    );
    if (!nameAnchor) return;
    setAdminTagNameStyle(nameAnchor, badgeTitlesIncludeAdminTag(parsed.badgeTitles || []));
  },

  /** Color or clear the profile h1 name link when an admin tag is on the profile. */
  applyToProfileHeader(): void {
    const h1 =
      document.querySelector('h1.css-8uhtka') ||
      document.querySelector('main h1') ||
      document.querySelector('article h1') ||
      document.querySelector('h1');
    if (!h1) return;

    const nameAnchor = h1.querySelector<HTMLElement>('a[href*="/rcon/players/"]');
    if (!nameAnchor) return;

    const badgeScope =
      document.querySelector('main') || document.querySelector('#RCONPlayerPage') || document;
    setAdminTagNameStyle(nameAnchor, scopeHasAdminTag(badgeScope));
  },

  /** Re-scan player rows + profile header (optional scoped root). */
  reconcileTaggedPlayers(root: ParentNode = document): void {
    const rows = root.querySelectorAll<HTMLElement>('div[data-session]');
    for (let r = 0; r < rows.length; r++) {
      const parsed = parsePlayerRow(rows[r]);
      if (parsed) this.applyToPlayerRow(parsed);
    }
    if (/\/rcon\/players\/\d+/.test(location.pathname)) {
      this.applyToProfileHeader();
    }
  },
};
