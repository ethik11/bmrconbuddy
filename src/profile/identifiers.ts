import { EOS_ID_RE, PROFILE_TAB_LABEL_RE, STEAM_ID64_RE } from '../constants';
import { normalizeWs } from '../dom/parsing';

/**
 * DOM locators/scrapers for the player profile page: page heading, sub-nav tabs,
 * the Identifiers table (SteamID64 / EOS / name), the bans table (crime+time),
 * and note crime+time. Used by the CBL header chip, Copy Player Info, and Note Menu.
 */

/** Profile activity-log root (`#RCONPlayerPage` or `main`). */
export function findProfileActivityLogRoot(): ParentNode {
  return document.querySelector('#RCONPlayerPage') || document.querySelector('main') || document;
}

/** Battlemetrics player-profile title; emotion class may change — fall back to main/article h1. */
export function findProfilePageH1(): HTMLHeadingElement | null {
  return (
    document.querySelector<HTMLHeadingElement>('h1.css-8uhtka') ||
    document.querySelector<HTMLHeadingElement>('main h1') ||
    document.querySelector<HTMLHeadingElement>('article h1') ||
    document.querySelector<HTMLHeadingElement>('h1')
  );
}

/** Identifiers table row by Type column label (Overview + Identifiers tab). */
function profileIdentifierCellByType(typeRe: RegExp): HTMLTableCellElement | null {
  const typeCells = document.querySelectorAll('td[data-title="Type"]');
  for (let i = 0; i < typeCells.length; i++) {
    const typeText = normalizeWs(typeCells[i].textContent || '');
    if (!typeRe.test(typeText)) continue;
    const row = typeCells[i].closest('tr');
    if (!row) continue;
    const idCell = row.querySelector<HTMLTableCellElement>('td[data-title="Identifier"]');
    if (idCell) return idCell;
  }
  return null;
}

function identifierTextFromCell(cell: Element | null): string {
  if (!cell) return '';
  const titled = cell.querySelector('[title]');
  if (titled && titled.getAttribute('title')) {
    const fromTitle = normalizeWs(titled.getAttribute('title') || '');
    if (fromTitle) return fromTitle;
  }
  return normalizeWs(cell.textContent || '');
}

/** Identifiers pane uses table cells or `span.css-q39y9k` with SteamID64 in `title`. */
export function extractSteamId64FromProfileIdentifiers(): string | null {
  const fromTable = identifierTextFromCell(profileIdentifierCellByType(/steam/i));
  const tableMatch = fromTable.match(STEAM_ID64_RE);
  if (tableMatch) return tableMatch[0];

  const spans = document.querySelectorAll('span.css-q39y9k[title]');
  for (let i = 0; i < spans.length; i++) {
    const title = normalizeWs(spans[i].getAttribute('title') || '');
    const m = title.match(STEAM_ID64_RE);
    if (m) return m[0];
  }
  for (let j = 0; j < spans.length; j++) {
    const raw = normalizeWs(spans[j].textContent || '');
    const m = raw.match(STEAM_ID64_RE);
    if (m) return m[0];
  }
  return null;
}

export function extractEosIdFromProfile(): string {
  const fromTable = identifierTextFromCell(profileIdentifierCellByType(/eos/i));
  const tableMatch = fromTable.match(EOS_ID_RE);
  if (tableMatch) return tableMatch[0];

  const table = document.querySelector('td[data-title="Type"]');
  const scope = table ? table.closest('table, section, main') || document : document;
  const nodes = scope.querySelectorAll('span[title], div[title], span.css-q39y9k');
  for (let i = 0; i < nodes.length; i++) {
    const raw = normalizeWs(nodes[i].getAttribute('title') || nodes[i].textContent || '');
    const m = raw.match(EOS_ID_RE);
    if (m) return m[0];
  }
  return '';
}

export function extractProfilePlayerName(): string {
  const fromTable = identifierTextFromCell(profileIdentifierCellByType(/^name$/i));
  if (fromTable) return fromTable;
  const h1 = findProfilePageH1();
  if (h1) return normalizeWs(h1.textContent || '');
  return '';
}

const BAN_EXPIRES_TITLES = ['Expires', 'Expiry', 'Expiration'];
const PERM_EXPIRES_RE = /^(perm|permanent|never)$/i;

function normalizeBanExpires(raw: string): string {
  const t = normalizeWs(raw);
  if (!t || PERM_EXPIRES_RE.test(t)) return 'Perm';
  return t;
}

function profileBanExpiresCell(row: Element): HTMLTableCellElement | null {
  for (let i = 0; i < BAN_EXPIRES_TITLES.length; i++) {
    const cell = row.querySelector<HTMLTableCellElement>(
      'td[data-title="' + BAN_EXPIRES_TITLES[i] + '"]',
    );
    if (cell) return cell;
  }
  return null;
}

/**
 * Crime / expiry from the first (most recent) bans-table row on the profile.
 * BM sorts bans newest-first; Identifiers uses Type/Identifier so Reason cells
 * are unique to the bans table.
 */
export function extractProfileBanCrimeTime(): { crime: string; time: string } {
  const reasonCell = document.querySelector<HTMLTableCellElement>('td[data-title="Reason"]');
  if (!reasonCell) return { crime: '', time: '' };
  const row = reasonCell.closest('tr');
  if (!row) return { crime: '', time: '' };

  const crime = identifierTextFromCell(reasonCell);
  const rawTime = identifierTextFromCell(profileBanExpiresCell(row));
  if (!crime && !rawTime) return { crime: '', time: '' };
  return { crime, time: normalizeBanExpires(rawTime) };
}

/** Crime / expiry from active player notes (Desktop toolkit parity). */
export function extractProfileNoteCrimeTime(): { crime: string; time: string } {
  const span =
    document.querySelector('.collapse.in ul li a span') ||
    document.querySelector('.collapse.show ul li a span') ||
    document.querySelector('[class*="collapse"] ul li a span');
  const raw = span ? normalizeWs(span.textContent || '') : '';
  if (!raw) return { crime: '', time: '' };
  let crime = '';
  let time = '';
  const dashParts = raw.split(' - ');
  if (dashParts.length > 1) {
    crime = dashParts[1].split(' | Expires')[0].trim();
  }
  const m = raw.match(/\| Expires:\s*([^|]+)/i);
  if (m) time = m[1].trim();
  return { crime, time };
}

/** Player profile sub-nav tabs (Overview, Identifiers, …). */
function profileSubnavTabLinks(): HTMLAnchorElement[] {
  const idMatch = location.pathname.match(/\/rcon\/players\/(\d+)/);
  if (!idMatch) return [];
  const playerId = idMatch[1];
  const links = document.querySelectorAll<HTMLAnchorElement>(
    'a[href*="/rcon/players/' + playerId + '"]',
  );
  const out: HTMLAnchorElement[] = [];
  for (let i = 0; i < links.length; i++) {
    const label = normalizeWs(links[i].textContent || '');
    if (!PROFILE_TAB_LABEL_RE.test(label)) continue;
    out.push(links[i]);
  }
  return out;
}

/** Copy button only on Overview (not Identifiers / Flags / Activity / …). */
export function isProfileOverviewTab(): boolean {
  if (!/\/rcon\/players\/\d+/.test(location.pathname)) return false;

  const sub = location.pathname.match(/\/rcon\/players\/\d+\/([^/?#]+)/i);
  if (sub && sub[1].toLowerCase() !== 'overview') return false;

  const tabs = profileSubnavTabLinks();
  for (let i = 0; i < tabs.length; i++) {
    if (tabs[i].getAttribute('aria-current') === 'page') {
      return /^overview$/i.test(normalizeWs(tabs[i].textContent || ''));
    }
  }

  return !sub;
}

/** Mount directly under the player name heading (Overview layout). */
export function findProfileCopyAnchorH1(): HTMLHeadingElement | null {
  const h1 = findProfilePageH1();
  if (!h1 || !h1.parentElement) return null;
  if (!normalizeWs(h1.textContent || '')) return null;
  return h1;
}
