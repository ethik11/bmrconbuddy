import { getFeedMessageElement, normalizeWs } from '../dom/parsing';
import { createStyleOverride } from '../dom/style-override';
import { getThemeSettings } from '../app/state';

/**
 * Feed phrase → inline text color. Colors the entire feed message `<div>` when a
 * phrase matches. Does NOT color individual player names (see admin-tag styler).
 */

const setMessageColor = createStyleOverride('color');

const FEED_PHRASE_SETS = {
  teamKilled: ['team killed'],

  // Mod actions (red) — player discipline
  actionList: [
    'was warned',
    'was kicked',
    'was banned',
    'edited BattleMetrics Ban',
    'added BattleMetrics Ban',
    'deleted BattleMetrics Ban',
  ],

  // Admin / server actions (green)
  adminTerms: [
    'admin',
    'Admin',
    'ADMIN',
    'aDMIN',
    'to the other team.',
    ') was disbanded b',
    'requested a list of squads.',
    'set the next map to',
    'changed the map to',
    'requested the next map.',
    ') forced',
    'AdminRenameSquad',
    '(Global)',
    'executed Player Action Action',
    'requested the current map.',
    'restarted the match.',
    'Squad disband - SL',
    'was removed from their squad by Trigger.',
    'requested layer list.',
    'was removed from their squad by',
    'added flag',
    'removed flag',
  ],

  // Faction team names in feed text
  teamBluefor: [
    'Australian Defence Force',
    'British Armed Forces',
    'Canadian Armed Forces',
    'United States Army',
    'United States Marine Corps',
  ],
  teamPac: ["People's Liberation Army", 'PLA Amphibious Ground Forces', 'PLA Navy Marine Corps'],
  teamOpfor: ['Russian Airborne Forces', 'Russian Ground Forces'],
  teamIndep: [
    'Western Private Military Contractors',
    'Middle Eastern Alliance',
    'Turkish Land Forces',
    'Middle Eastern Insurgents',
    'Irregular Militia Forces',
  ],

  // Known auto-kick / auto-warn spam (gray)
  trackedTriggers: [
    'Welcome to gMg!',
    'We offer FREE WHITELIST',
    'Auto-Warn | Squads containing MBTs',
    'Auto-Warn | Vehicles requiring crewman',
    'Seeding progress degrades',
    'Auto-Warn | Piloting a Heli?',
    'Auto-Warn | New pilots are NOT permitted',
    'Auto Kick - Username must contain',
    'Welcome to gMg! Be sure to join',
    'You are earning FREE',
    'There are over 88',
    'Auto Kick - Your Steam Community',
    'Streaming? Consider a minimum',
    'Join a squad, you are unassigned and will be kicked',
    'No more facts for you. Touch grass.',
    'Seeding Reward:',
    'Auto-Kick | Steam Account must be at least 14 days',
  ],
};

export const FeedTextColorEngine = {
  applyToMessage(msgEl: HTMLElement, text: string): void {
    if (!msgEl) return;
    let color: string | null = null;
    const theme = getThemeSettings();

    if (this.matchPhrases(text, FEED_PHRASE_SETS.adminTerms)) {
      color = theme.feedAdminAction;
    }
    if (this.matchPhrases(text, FEED_PHRASE_SETS.actionList)) {
      color = theme.feedModAction;
    }
    if (this.matchPhrases(text, FEED_PHRASE_SETS.teamBluefor)) {
      color = theme.feedTeamBluefor;
    } else if (this.matchPhrases(text, FEED_PHRASE_SETS.teamPac)) {
      color = theme.feedTeamPac;
    } else if (this.matchPhrases(text, FEED_PHRASE_SETS.teamOpfor)) {
      color = theme.feedTeamOpfor;
    } else if (this.matchPhrases(text, FEED_PHRASE_SETS.teamIndep)) {
      color = theme.feedTeamIndep;
    }
    if (this.matchPhrases(text, FEED_PHRASE_SETS.teamKilled)) {
      color = theme.feedTeamKilled;
    }
    if (this.matchPhrases(text, FEED_PHRASE_SETS.trackedTriggers)) {
      color = theme.feedTracked;
    }
    setMessageColor(msgEl, color);
  },

  matchPhrases(text: string, phrases: string[]): boolean {
    for (let i = 0; i < phrases.length; i++) {
      if (text.indexOf(phrases[i]) !== -1) return true;
    }
    return false;
  },

  applyToLine(lineEl: HTMLElement): void {
    const msg = getFeedMessageElement(lineEl);
    if (!msg) return;
    const text = normalizeWs(msg.textContent || '');
    this.applyToMessage(msg, text);
  },
};
