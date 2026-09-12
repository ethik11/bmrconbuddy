import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { ConnectedPlayersPanel } from '../../src/panels/connected-players';
import { CBL_FOR_ATTR } from '../../src/constants';
import { CssInjector } from '../../src/dom/css';
import type { CblReputationService } from '../../src/cbl/service';
import type { CblPayload, CblWaiter, HighlightRule } from '../../src/types';

const STEAM = '76561190000000001';
const SECOND_STEAM = '76561190000000002';
const okPayload: CblPayload = {
  kind: 'ok',
  reputationPoints: 5,
  riskRating: '5/10',
  reputationRank: 1,
  displayName: 'X',
};

// Minimal stand-in for the CBL service: returns cached data synchronously (no network).
function fakeCblService(
  overrides: Partial<Pick<CblReputationService, 'getCached' | 'enqueue'>> = {},
): CblReputationService {
  return {
    loadCache() {},
    getCached: () => okPayload,
    enqueue: () => {},
    ...overrides,
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

function recyclePlayerRow(row: HTMLElement, steamId = SECOND_STEAM): void {
  row.setAttribute('data-session', 's2');
  const name = row.querySelector<HTMLAnchorElement>('div.name a')!;
  name.href = '/rcon/players/456';
  name.firstChild!.nodeValue = 'AnotherPlayer';
  row.querySelector('[data-title="Platform ID"] span')!.setAttribute('title', steamId);
}

describe('ConnectedPlayersPanel (integration)', () => {
  const style = document.createElement('style');
  beforeAll(() => {
    style.textContent = CssInjector.buildRules().join('\n');
    document.head.appendChild(style);
  });
  afterAll(() => style.remove());
  afterEach(() => vi.useRealTimers());

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

    expect(row.querySelector(`[${CBL_FOR_ATTR}="${STEAM}"]`)).toBeTruthy();
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

  it('replaces a recycled row chip with the current player, without duplicates', () => {
    const row = mountPlayerRow(false);
    const panel = new ConnectedPlayersPanel(
      fakeCblService(),
      () => [],
      () => '',
    );
    panel.scan();
    recyclePlayerRow(row);
    panel.scan();
    panel.scan();

    const chips = row.querySelectorAll(`[${CBL_FOR_ATTR}]`);
    expect(chips).toHaveLength(1);
    expect(chips[0].getAttribute(CBL_FOR_ATTR)).toBe(SECOND_STEAM);
  });

  it('removes the previous chip while the new player identifier is unavailable', () => {
    const row = mountPlayerRow(false);
    const panel = new ConnectedPlayersPanel(
      fakeCblService(),
      () => [],
      () => '',
    );
    panel.scan();
    recyclePlayerRow(row, 'loading');
    panel.scan();

    expect(row.querySelector(`[${CBL_FOR_ATTR}]`)).toBeNull();
    expect(row.querySelector('div.name')?.classList.contains('bss-toolkit-name-row')).toBe(false);
  });

  it('reconciles identifier-only mutations after the existing 400ms delay', async () => {
    vi.useFakeTimers();
    const row = mountPlayerRow(false);
    const panel = new ConnectedPlayersPanel(
      fakeCblService(),
      () => [],
      () => '',
    );
    panel.start();
    try {
      recyclePlayerRow(row);
      await vi.advanceTimersByTimeAsync(400);
      const chips = row.querySelectorAll(`[${CBL_FOR_ATTR}]`);
      expect(chips).toHaveLength(1);
      expect(chips[0].getAttribute(CBL_FOR_ATTR)).toBe(SECOND_STEAM);
      await vi.advanceTimersByTimeAsync(800);
      expect(vi.getTimerCount()).toBe(0); // Our own decorations must not keep the observer active.
    } finally {
      panel.stop();
    }
  });

  it('ignores a delayed response after row reuse, even before the next scan', () => {
    const waiters = new Map<string, CblWaiter>();
    const service = fakeCblService({
      getCached: () => null,
      enqueue: (id, callback) => {
        waiters.set(id, callback);
      },
    });
    const row = mountPlayerRow(false);
    const panel = new ConnectedPlayersPanel(
      service,
      () => [],
      () => '',
    );
    panel.scan();
    recyclePlayerRow(row);
    waiters.get(STEAM)!(null, okPayload);
    expect(row.querySelector(`[${CBL_FOR_ATTR}]`)).toBeNull();

    panel.scan();
    waiters.get(SECOND_STEAM)!(null, okPayload);
    expect(row.querySelector(`[${CBL_FOR_ATTR}]`)?.getAttribute(CBL_FOR_ATTR)).toBe(SECOND_STEAM);
  });

  it.each(['', 'coolplayer'])('keeps rule-hidden players hidden with filter "%s"', (filter) => {
    const row = mountPlayerRow(false);
    const rules: HighlightRule[] = [
      {
        id: 'hide-player',
        enabled: true,
        steamIdInList: [STEAM],
        actions: [{ type: 'hideRow' }],
      },
    ];
    const panel = new ConnectedPlayersPanel(
      fakeCblService(),
      () => rules,
      () => filter,
    );
    panel.scan();
    panel.refreshPlayerRowVisuals();
    expect(getComputedStyle(row).display).toBe('none');

    rules[0].enabled = false;
    panel.refreshPlayerRowVisuals();
    expect(getComputedStyle(row).display).not.toBe('none');
  });

  it('keeps text filtering active when a hide rule is removed', () => {
    const row = mountPlayerRow(false);
    let filter = 'does-not-match';
    let rules: HighlightRule[] = [
      {
        id: 'hide-player',
        enabled: true,
        steamIdInList: [STEAM],
        actions: [{ type: 'hideRow' }],
      },
    ];
    const panel = new ConnectedPlayersPanel(
      fakeCblService(),
      () => rules,
      () => filter,
    );
    panel.scan();
    rules = [];
    panel.scan();
    expect(getComputedStyle(row).display).toBe('none');

    filter = '';
    panel.scan();
    expect(getComputedStyle(row).display).not.toBe('none');
  });
});
