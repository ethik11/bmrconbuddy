import { BM_FLAG_ROW_CLASSES } from '../constants';
import { normalizeWs } from '../dom/parsing';
import { isAdminBadgeTitle } from './admin-tag';
import type { ParsedPlayerRow, SteamBanSnapshot } from '../types';

/** Player row flag tints. Priority: Admin (pink) → Sus (orange) → VAC/game ban (red). */
export const PlayerFlagStyler = {
  clear(rowEl: HTMLElement): void {
    for (let i = 0; i < BM_FLAG_ROW_CLASSES.length; i++) {
      rowEl.classList.remove(BM_FLAG_ROW_CLASSES[i]);
    }
  },

  /** Returns true when a tint was applied (first match wins). */
  apply(parsed: ParsedPlayerRow, steamSnap: SteamBanSnapshot | null): boolean {
    const titles = parsed.badgeTitles || [];
    const row = parsed.rowEl;

    for (let i = 0; i < titles.length; i++) {
      if (isAdminBadgeTitle(titles[i])) {
        row.classList.add('bss-toolkit-bmflag-admin');
        return true;
      }
    }

    for (let i = 0; i < titles.length; i++) {
      if (normalizeWs(titles[i]).toLowerCase() === 'sus') {
        row.classList.add('bss-toolkit-bmflag-sus');
        return true;
      }
    }

    if (steamSnap && !steamSnap.loading && steamSnap.vacOrGameBan) {
      row.classList.add('bss-toolkit-bmflag-steam-ban');
      return true;
    }

    return false;
  },
};

export function resetBuiltinPlayerRowVisuals(rowEl: HTMLElement): void {
  rowEl.classList.remove('bss-toolkit-player-accent');
  PlayerFlagStyler.clear(rowEl);
}
