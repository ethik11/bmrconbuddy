import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerFlagStyler } from '../../src/players/flag-styler';
import type { ParsedPlayerRow, SteamBanSnapshot } from '../../src/types';

function player(over: Partial<ParsedPlayerRow> = {}): ParsedPlayerRow {
  return {
    steamId64: '76561190000000001',
    displayName: 'Cool',
    roleText: 'Role: Rifleman',
    teamText: 'Team A',
    squadText: 'Squad 1',
    badgeTitles: [],
    hasPlayerNote: false,
    rowEl: document.createElement('div'),
    ...over,
  };
}

describe('PlayerFlagStyler', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('tints Problem Player red', () => {
    const parsed = player({ badgeTitles: ['Problem Player'] });
    expect(PlayerFlagStyler.apply(parsed, null)).toBe(true);
    expect(parsed.rowEl.classList.contains('bss-toolkit-bmflag-problem')).toBe(true);
  });

  it('matches Problem Player case-insensitively after whitespace normalize', () => {
    const parsed = player({ badgeTitles: ['  problem player  '] });
    expect(PlayerFlagStyler.apply(parsed, null)).toBe(true);
    expect(parsed.rowEl.classList.contains('bss-toolkit-bmflag-problem')).toBe(true);
  });

  it('lets admin beat Problem Player', () => {
    const parsed = player({ badgeTitles: ['Problem Player', 'NL Squad Admin'] });
    expect(PlayerFlagStyler.apply(parsed, null)).toBe(true);
    expect(parsed.rowEl.classList.contains('bss-toolkit-bmflag-admin')).toBe(true);
    expect(parsed.rowEl.classList.contains('bss-toolkit-bmflag-problem')).toBe(false);
  });

  it('lets Problem Player beat Sus', () => {
    const parsed = player({ badgeTitles: ['Sus', 'Problem Player'] });
    expect(PlayerFlagStyler.apply(parsed, null)).toBe(true);
    expect(parsed.rowEl.classList.contains('bss-toolkit-bmflag-problem')).toBe(true);
    expect(parsed.rowEl.classList.contains('bss-toolkit-bmflag-sus')).toBe(false);
  });

  it('does not treat a partial title as Problem Player', () => {
    const parsed = player({ badgeTitles: ['Problem'] });
    const steamSnap: SteamBanSnapshot = { loading: false, vacOrGameBan: false };
    expect(PlayerFlagStyler.apply(parsed, steamSnap)).toBe(false);
    expect(parsed.rowEl.classList.contains('bss-toolkit-bmflag-problem')).toBe(false);
  });
});
