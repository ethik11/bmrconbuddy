import { describe, expect, it } from 'vitest';
import { HighlightRuleEngine } from '../../src/highlight/rules';
import type { HighlightRule } from '../../src/types';

const rules: HighlightRule[] = [
  {
    id: 'kick',
    enabled: true,
    feedLineMatches: 'kicked',
    actions: [
      { type: 'setRowClass', className: 'native-row' },
      { type: 'setRowClass', className: 'custom-kick' },
      { type: 'setBorderColor', borderColor: 'red' },
    ],
  },
  {
    id: 'later-border',
    enabled: true,
    feedLineMatches: 'kicked',
    actions: [{ type: 'setBorderColor', borderColor: 'orange' }],
  },
];

describe('highlight action cleanup', () => {
  it('restores existing classes and partial border styles after repeated rule passes', () => {
    const row = document.createElement('div');
    row.classList.add('native-row');
    row.style.setProperty('border-left-width', '2px', 'important');
    row.style.backgroundColor = 'blue';
    HighlightRuleEngine.applyFeed(rules, row, 'Player was kicked');
    HighlightRuleEngine.applyFeed(rules, row, 'Player was kicked');
    expect(row.style.borderLeftColor).toBe('orange');
    expect(row.classList.contains('custom-kick')).toBe(true);

    HighlightRuleEngine.applyFeed(rules, row, 'Player connected');
    expect([...row.classList]).toEqual(['native-row']);
    expect(row.style.borderLeftWidth).toBe('2px');
    expect(row.style.getPropertyPriority('border-left-width')).toBe('important');
    expect(row.style.borderLeftStyle).toBe('');
    expect(row.style.borderLeftColor).toBe('');
    expect(row.style.backgroundColor).toBe('blue');
  });

  it('preserves a newer host border color while removing owned width and style', () => {
    const row = document.createElement('div');
    HighlightRuleEngine.applyFeed(rules, row, 'Player was kicked');
    row.style.setProperty('border-left-color', 'purple', 'important');
    HighlightRuleEngine.applyFeed([], row, 'Player connected');

    expect(row.style.borderLeftColor).toBe('purple');
    expect(row.style.getPropertyPriority('border-left-color')).toBe('important');
    expect(row.style.borderLeftWidth).toBe('');
    expect(row.style.borderLeftStyle).toBe('');
  });
});
