import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectedPlayersPanel } from '../../src/panels/connected-players';
import type { CblReputationService } from '../../src/cbl/service';
import type { CblPayload } from '../../src/types';

const STEAM = '76561190000000001';
const okPayload: CblPayload = {
  kind: 'ok',
  reputationPoints: 5,
  riskRating: '5/10',
  reputationRank: 1,
  displayName: 'X',
};

// Minimal stand-in for the CBL service: returns cached data synchronously (no network).
function fakeCblService(): CblReputationService {
  return {
    loadCache() {},
    getCached: () => okPayload,
    enqueue: () => {},
  } as unknown as CblReputationService;
}

function mountPlayerRow(adminBadge = true): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-session', 's1');
  el.innerHTML = `
    <div class="name">
      <a href="/rcon/players/123">CoolPlayer</a>
      ${adminBadge ? '<svg title="NL Squad Admin"></svg>' : ''}
    </div>
    <div data-title="Platform ID"><span title="${STEAM}">x</span></div>
    <div data-title="Team">Team A</div>
    <div data-title="Squad">Squad 1</div>`;
  document.body.appendChild(el);
  return el;
}

describe('ConnectedPlayersPanel (integration)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts a CBL chip, tints the row, and cyan-colors an admin name', () => {
    const row = mountPlayerRow(true);
    new ConnectedPlayersPanel(
      fakeCblService(),
      () => [],
      () => '',
    ).scan();

    expect(row.querySelector(`[data-bss-cbl-for="${STEAM}"]`)).toBeTruthy();
    expect(row.classList.contains('bss-toolkit-bmflag-admin')).toBe(true);
    expect(row.querySelector('div.name a')?.classList.contains('bss-toolkit-admin-tag-name')).toBe(
      true,
    );
  });

  it('hides rows that do not match the player filter', () => {
    const row = mountPlayerRow(false);
    new ConnectedPlayersPanel(
      fakeCblService(),
      () => [],
      () => 'zzz-no-match',
    ).scan();
    expect(row.classList.contains('bss-toolkit-player-filtered')).toBe(true);
  });

  it('keeps matching rows visible', () => {
    const row = mountPlayerRow(false);
    new ConnectedPlayersPanel(
      fakeCblService(),
      () => [],
      () => 'coolplayer',
    ).scan();
    expect(row.classList.contains('bss-toolkit-player-filtered')).toBe(false);
  });
});
