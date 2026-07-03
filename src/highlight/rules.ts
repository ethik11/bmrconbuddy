import { getColorRowsByBmFlags, getSteamBanLookup } from '../app/state';
import { normalizeWs, playerRowSearchBlob } from '../dom/parsing';
import { PlayerFlagStyler, resetBuiltinPlayerRowVisuals } from '../players/flag-styler';
import type { HighlightAction, HighlightRule, ParsedPlayerRow } from '../types';

/**
 * Highlight rules for player rows and feed lines. `applyPlayer` reads the Steam
 * ban lookup + BM-flag toggle through app/state accessors (rather than a shared
 * global), which keeps this module from importing app/routing.
 */
export const HighlightRuleEngine = {
  applyPlayer(rules: HighlightRule[], parsed: ParsedPlayerRow): void {
    const row = parsed.rowEl;
    resetBuiltinPlayerRowVisuals(row);
    const lookup = getSteamBanLookup();
    const steamSnap = lookup ? lookup.getSnapshot(parsed.steamId64) : null;
    if (getColorRowsByBmFlags()) {
      if (!PlayerFlagStyler.apply(parsed, steamSnap)) {
        row.classList.add('bss-toolkit-player-accent');
      }
    } else {
      row.classList.add('bss-toolkit-player-accent');
    }

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (!rule || !rule.enabled) continue;
      if (!this.matchPlayer(rule, parsed)) continue;
      this.applyActions(row, rule.actions);
    }
  },

  applyFeed(rules: HighlightRule[], lineEl: HTMLElement, lineText: string): void {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (!rule || !rule.enabled || !rule.feedLineMatches) continue;
      try {
        const re = new RegExp(rule.feedLineMatches, 'i');
        if (!re.test(lineText)) continue;
      } catch {
        if (lineText.toLowerCase().indexOf(String(rule.feedLineMatches).toLowerCase()) === -1) {
          continue;
        }
      }
      this.applyActions(lineEl, rule.actions);
    }
  },

  matchPlayer(rule: HighlightRule, parsed: ParsedPlayerRow): boolean {
    if (rule.steamIdInList && rule.steamIdInList.length) {
      if (rule.steamIdInList.indexOf(parsed.steamId64) === -1) return false;
    }
    if (
      rule.teamEquals !== undefined &&
      rule.teamEquals !== null &&
      String(rule.teamEquals) !== ''
    ) {
      if (normalizeWs(parsed.teamText) !== String(rule.teamEquals)) return false;
    }
    if (rule.roleMatches) {
      try {
        const rre = new RegExp(rule.roleMatches, 'i');
        if (!rre.test(parsed.roleText || '')) return false;
      } catch {
        if (
          (parsed.roleText || '').toLowerCase().indexOf(String(rule.roleMatches).toLowerCase()) ===
          -1
        ) {
          return false;
        }
      }
    }
    if (rule.badgeTitleContains) {
      let ok = false;
      for (let i = 0; i < parsed.badgeTitles.length; i++) {
        if (
          parsed.badgeTitles[i].toLowerCase().indexOf(rule.badgeTitleContains.toLowerCase()) !== -1
        ) {
          ok = true;
          break;
        }
      }
      if (!ok) return false;
    }
    if (rule.textMatches) {
      try {
        const tre = new RegExp(rule.textMatches, 'i');
        if (!tre.test(playerRowSearchBlob(parsed))) return false;
      } catch {
        if (playerRowSearchBlob(parsed).indexOf(String(rule.textMatches).toLowerCase()) === -1) {
          return false;
        }
      }
    }
    // A rule with no criteria must NOT match everything.
    return (
      !!(rule.steamIdInList && rule.steamIdInList.length) ||
      (rule.teamEquals !== undefined &&
        rule.teamEquals !== null &&
        String(rule.teamEquals) !== '') ||
      !!rule.roleMatches ||
      !!rule.badgeTitleContains ||
      !!rule.textMatches
    );
  },

  applyActions(el: HTMLElement, actions: HighlightAction[]): void {
    if (!actions) return;
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      if (!a) continue;
      if (a.type === 'setRowClass' && a.className) el.classList.add(a.className);
      if (a.type === 'setBorderColor' && a.borderColor) {
        el.style.borderLeft = '3px solid ' + a.borderColor;
      }
      if (a.type === 'hideRow') el.classList.add('bss-toolkit-player-filtered');
    }
  },
};
