import { CBL_FOR_ATTR, PROCESSED_ATTR } from '../constants';
import { CblRatingChip } from '../cbl/chip';
import type { CblReputationService } from '../cbl/service';
import {
  parsePlayerRow,
  playerRowSearchBlob,
  stripBssToolkitClassesFromElement,
} from '../dom/parsing';
import { HighlightRuleEngine } from '../highlight/rules';
import { AdminTagNameStyler } from '../players/admin-tag';
import { matchesFilter } from '../players/filter';
import type { HighlightRule, ParsedPlayerRow } from '../types';

/**
 * Watches `div[data-session]` rows: CBL chip, BM flag tint, admin-tag name, filter.
 * A 400ms reconcile catches virtual-scroll recycled rows.
 */
export class ConnectedPlayersPanel {
  private observer: MutationObserver | null = null;
  private reconcileTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly cblService: CblReputationService,
    private readonly getRules: () => HighlightRule[],
    private readonly getPlayerFilter: () => string,
  ) {}

  private reconcileRowChips(rowEl: HTMLElement, steamId64: string | null): boolean {
    const nameCol = rowEl.querySelector('div.name');
    if (!nameCol) return false;
    let hasChip = false;
    for (const chip of nameCol.querySelectorAll('[' + CBL_FOR_ATTR + ']')) {
      if (steamId64 && chip.getAttribute(CBL_FOR_ATTR) === steamId64) {
        hasChip = true;
      } else {
        chip.remove();
      }
    }
    if (!hasChip) nameCol.classList.remove('bss-toolkit-name-row');
    return hasChip;
  }

  processRow(rowEl: HTMLElement): void {
    const parsed = parsePlayerRow(rowEl);
    const hasChip = this.reconcileRowChips(rowEl, parsed?.steamId64 ?? null);
    if (!parsed) {
      if (rowEl.getAttribute('data-session')) rowEl.setAttribute(PROCESSED_ATTR, '0');
      return;
    }

    // Virtual scroll recycles row nodes for different players, so name color,
    // BM-flag tint, and filter state must be recomputed every pass.
    AdminTagNameStyler.applyToPlayerRow(parsed);
    HighlightRuleEngine.applyPlayer(this.getRules(), parsed);
    this.applyPlayerFilter(parsed);

    // The CBL chip is expensive (network) and stable per steamId, so mount it once.
    if (rowEl.getAttribute(PROCESSED_ATTR) === '1' && hasChip) return;

    rowEl.setAttribute(PROCESSED_ATTR, '1');

    const nameCol = rowEl.querySelector<HTMLElement>('div.name');
    if (nameCol && !hasChip) CblRatingChip.mount(nameCol, parsed.steamId64, this.cblService);
  }

  private processAddedNode(node: Node): void {
    if (!node || node.nodeType !== 1) return;
    const el = node as HTMLElement;
    if (el.matches && el.matches('div[data-session]')) this.processRow(el);
    if (el.querySelectorAll) {
      const rows = el.querySelectorAll<HTMLElement>('div[data-session]');
      for (let i = 0; i < rows.length; i++) this.processRow(rows[i]);
    }
  }

  private scheduleReconcile(): void {
    if (this.reconcileTimer) return;
    this.reconcileTimer = setTimeout(() => {
      this.reconcileTimer = null;
      const rows = document.querySelectorAll<HTMLElement>('div[data-session]');
      for (let i = 0; i < rows.length; i++) this.processRow(rows[i]);
    }, 400);
  }

  applyPlayerFilter(parsed: ParsedPlayerRow): void {
    const visible = matchesFilter(playerRowSearchBlob(parsed), this.getPlayerFilter());
    parsed.rowEl.classList.toggle('bss-toolkit-player-filtered', !visible);
  }

  scan(): void {
    const rows = document.querySelectorAll<HTMLElement>('div[data-session]');
    for (let i = 0; i < rows.length; i++) this.processRow(rows[i]);
  }

  /** Re-apply BM flag / accent styling after a settings change (no duplicate CBL chips). */
  refreshPlayerRowVisuals(): void {
    const rows = document.querySelectorAll<HTMLElement>(
      'div[data-session][' + PROCESSED_ATTR + '="1"]',
    );
    for (let i = 0; i < rows.length; i++) {
      const parsed = parsePlayerRow(rows[i]);
      if (!parsed) continue;
      AdminTagNameStyler.applyToPlayerRow(parsed);
      HighlightRuleEngine.applyPlayer(this.getRules(), parsed);
      this.applyPlayerFilter(parsed);
    }
  }

  /** After SPA navigation the same DOM nodes may be reused; clear markers and re-run. */
  prepareForSpaRescan(): void {
    const rows = document.querySelectorAll<HTMLElement>('div[data-session]');
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      row.removeAttribute(PROCESSED_ATTR);
      const wraps = row.querySelectorAll('.bss-toolkit-cbl-wrap');
      for (let w = 0; w < wraps.length; w++) wraps[w].remove();
      const nameCol = row.querySelector('div.name');
      if (nameCol) nameCol.classList.remove('bss-toolkit-name-row');
      stripBssToolkitClassesFromElement(row);
    }
    this.scan();
  }

  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.reconcileTimer) {
      clearTimeout(this.reconcileTimer);
      this.reconcileTimer = null;
    }
  }

  start(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.cblService.loadCache();
    this.scan();
    this.observer = new MutationObserver((mutations) => {
      for (let m = 0; m < mutations.length; m++) {
        const mu = mutations[m];
        if (mu.type === 'childList') {
          const target = mu.target;
          if (
            target instanceof HTMLElement &&
            target.matches &&
            target.matches('div[data-session]')
          ) {
            this.processRow(target);
          }
          const added = mu.addedNodes;
          for (let j = 0; j < added.length; j++) {
            this.processAddedNode(added[j]);
          }
        }
      }
      this.scheduleReconcile();
    });
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      // React can reuse a row by changing only its identifiers and text. Avoid
      // observing our own class/style changes, which would reschedule every scan.
      attributeFilter: ['data-session', 'title', 'href'],
    });
  }
}
