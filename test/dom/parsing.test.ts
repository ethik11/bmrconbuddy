import { describe, it, expect } from 'vitest';
import {
  normalizeWs,
  playerRowSearchBlob,
  parsePlayerRow,
  extractSteamId64FromRow,
  getFeedMessageElement,
  isFeedLineStructure,
  resolveFeedLineContainer,
  getFeedLineText,
} from '../../src/dom/parsing';
import type { ParsedPlayerRow } from '../../src/types';

const STEAM = '76561190000000001';

describe('normalizeWs', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeWs('  a\n  b\t c ')).toBe('a b c');
    expect(normalizeWs(null)).toBe('');
    expect(normalizeWs(undefined)).toBe('');
  });
});

describe('playerRowSearchBlob', () => {
  it('joins fields lowercased', () => {
    const p: ParsedPlayerRow = {
      steamId64: STEAM,
      displayName: 'Cool',
      roleText: 'Role: Rifleman',
      teamText: 'Team A',
      squadText: 'Squad 1',
      badgeTitles: ['NL Squad Admin', 'Sus'],
      hasPlayerNote: false,
      rowEl: document.createElement('div'),
    };
    expect(playerRowSearchBlob(p)).toBe(
      `cool ${STEAM} role: rifleman team a squad 1 nl squad admin sus`,
    );
  });
});

function playerRow(): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-session', 's1');
  el.innerHTML = `
    <div class="name">
      <a href="/rcon/players/123">CoolPlayer</a>
      <svg title="NL Squad Admin"></svg>
      <span title="Sus"></span>
    </div>
    <div class="player-detail"><span class="text-muted">Role: Rifleman</span></div>
    <div data-title="Platform ID"><span title="${STEAM}">hidden</span></div>
    <div data-title="Team">Team A</div>
    <div data-title="Squad">Squad 1</div>
    <span class="css-sq8q19"></span>`;
  return el;
}

describe('extractSteamId64FromRow / parsePlayerRow', () => {
  it('reads the SteamID64 from the Platform ID cell title', () => {
    expect(extractSteamId64FromRow(playerRow())).toBe(STEAM);
  });

  it('parses a full connected-player row', () => {
    const parsed = parsePlayerRow(playerRow());
    expect(parsed).not.toBeNull();
    expect(parsed).toMatchObject({
      steamId64: STEAM,
      displayName: 'CoolPlayer',
      roleText: 'Role: Rifleman',
      teamText: 'Team A',
      squadText: 'Squad 1',
      badgeTitles: ['NL Squad Admin', 'Sus'],
      hasPlayerNote: true,
    });
  });

  it('returns null without a data-session or a valid SteamID64', () => {
    const noSession = document.createElement('div');
    expect(parsePlayerRow(noSession)).toBeNull();
  });
});

describe('feed line detection', () => {
  it('handles the legacy <time><div> layout', () => {
    const line = document.createElement('div');
    line.innerHTML = `<time datetime="2026-01-01T00:00:00Z"></time><div>Player was kicked</div>`;
    expect(isFeedLineStructure(line)).toBe(true);
    expect(getFeedMessageElement(line)?.textContent).toBe('Player was kicked');
    expect(getFeedLineText(line)).toBe('Player was kicked');
  });

  it('handles the BM <span><time></span><div> layout and resolves the container', () => {
    const line = document.createElement('div');
    line.innerHTML = `<span><time datetime="2026-01-01T00:00:00Z"></time></span><div>Map changed</div>`;
    document.body.appendChild(line);
    const timeEl = line.querySelector('time')!;
    expect(resolveFeedLineContainer(timeEl.parentElement)).toBe(line);
    expect(getFeedLineText(line)).toBe('Map changed');
  });

  it('does NOT treat a player-row "Play Time" (ISO 8601 duration) as a feed line', () => {
    // A connected-player row carries <time datetime="PT37M33S"> with the same time+div
    // shape as a feed line; only its absolute-vs-duration datetime distinguishes them.
    const row = document.createElement('div');
    row.innerHTML = `<time datetime="PT37M33.108S">37m</time><div>Nirmata</div>`;
    document.body.appendChild(row);
    expect(isFeedLineStructure(row)).toBe(false);
    expect(resolveFeedLineContainer(row.querySelector('time')!.parentElement)).toBeNull();
  });
});
