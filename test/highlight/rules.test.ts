import { describe, it, expect } from 'vitest';
import { HighlightRuleEngine } from '../../src/highlight/rules';
import type { HighlightRule, ParsedPlayerRow } from '../../src/types';

function player(over: Partial<ParsedPlayerRow> = {}): ParsedPlayerRow {
  return {
    steamId64: '76561190000000001',
    displayName: 'Cool',
    roleText: 'Role: Rifleman',
    teamText: 'Team A',
    squadText: 'Squad 1',
    badgeTitles: ['Sus'],
    hasPlayerNote: false,
    rowEl: document.createElement('div'),
    ...over,
  };
}

function rule(over: Partial<HighlightRule>): HighlightRule {
  return { id: 'r', enabled: true, actions: [], ...over };
}

describe('HighlightRuleEngine.matchPlayer', () => {
  it('does NOT match a rule with no criteria', () => {
    expect(HighlightRuleEngine.matchPlayer(rule({}), player())).toBe(false);
  });

  it('matches on steamIdInList membership', () => {
    expect(
      HighlightRuleEngine.matchPlayer(rule({ steamIdInList: ['76561190000000001'] }), player()),
    ).toBe(true);
    expect(HighlightRuleEngine.matchPlayer(rule({ steamIdInList: ['999'] }), player())).toBe(false);
  });

  it('matches teamEquals after whitespace normalization', () => {
    expect(
      HighlightRuleEngine.matchPlayer(
        rule({ teamEquals: 'Team A' }),
        player({ teamText: ' Team   A ' }),
      ),
    ).toBe(true);
    expect(HighlightRuleEngine.matchPlayer(rule({ teamEquals: 'Team B' }), player())).toBe(false);
  });

  it('matches roleMatches as regex, falling back to substring on invalid regex', () => {
    expect(HighlightRuleEngine.matchPlayer(rule({ roleMatches: 'rifle' }), player())).toBe(true);
    // invalid regex "(" -> substring fallback against roleText
    expect(HighlightRuleEngine.matchPlayer(rule({ roleMatches: 'rifleman(' }), player())).toBe(
      false,
    );
  });

  it('matches badgeTitleContains (case-insensitive)', () => {
    expect(HighlightRuleEngine.matchPlayer(rule({ badgeTitleContains: 'sus' }), player())).toBe(
      true,
    );
    expect(HighlightRuleEngine.matchPlayer(rule({ badgeTitleContains: 'admin' }), player())).toBe(
      false,
    );
  });

  it('matches textMatches against the player search blob', () => {
    expect(HighlightRuleEngine.matchPlayer(rule({ textMatches: 'cool' }), player())).toBe(true);
    expect(HighlightRuleEngine.matchPlayer(rule({ textMatches: 'zzzz' }), player())).toBe(false);
  });
});
