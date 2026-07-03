import { describe, it, expect } from 'vitest';
import { buildCblChipElement } from '../../src/cbl/chip';
import type { CblRatingData } from '../../src/types';

const STEAM = '76561190000000001';

function data(over: Partial<CblRatingData> = {}): CblRatingData {
  return {
    reputationPoints: null,
    riskRating: null,
    reputationRank: null,
    displayName: null,
    ...over,
  };
}

describe('buildCblChipElement', () => {
  it('builds a full chip linking to the CBL search page', () => {
    const chip = buildCblChipElement(
      STEAM,
      data({ reputationPoints: 5, riskRating: '5/10', reputationRank: 42, displayName: 'X' }),
    );
    expect(chip.tagName).toBe('A');
    expect(chip.className).toContain('bss-toolkit-cbl-chip');
    expect(chip.getAttribute('href')).toBe(`https://communitybanlist.com/search/${STEAM}`);
    expect(chip.textContent).toBe('CBL · RP 5 · Risk 5/10 · #42');
    expect(chip.title).toBe('X — Community Ban List');
  });

  it('builds a compact chip quoting reputation points', () => {
    const chip = buildCblChipElement(STEAM, data({ reputationPoints: 5 }), 'x', 'compact');
    expect(chip.className).toContain('x');
    expect(chip.textContent).toBe("CBL: '5'");
  });

  it('quotes the risk rating when reputation points are absent', () => {
    const chip = buildCblChipElement(STEAM, data({ riskRating: '7/10' }), undefined, 'compact');
    expect(chip.textContent).toBe("CBL: '7/10'");
  });

  it('falls back to an em dash when neither is present', () => {
    const chip = buildCblChipElement(STEAM, data(), undefined, 'compact');
    expect(chip.textContent).toBe("CBL: '—'");
  });
});
