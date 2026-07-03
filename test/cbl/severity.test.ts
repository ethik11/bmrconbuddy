import { describe, it, expect } from 'vitest';
import {
  clamp01,
  parseFloatFromRiskString,
  computeCblChipSeverity01,
  cblHasReputationOrRiskRating,
  cblDetailParts,
} from '../../src/cbl/severity';
import type { CblPayload } from '../../src/types';

describe('clamp01', () => {
  it('clamps to [0,1]', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
  });
});

describe('parseFloatFromRiskString', () => {
  it('parses an "x / 10" risk string', () => {
    expect(parseFloatFromRiskString('7.5 / 10')).toBe(0.75);
    expect(parseFloatFromRiskString('0/10')).toBe(0);
    expect(parseFloatFromRiskString('Risk: 6/10')).toBe(0.6);
  });

  it('scales a bare number: <=10 by /10, otherwise clamp(n/100)', () => {
    expect(parseFloatFromRiskString('8')).toBe(0.8);
    expect(parseFloatFromRiskString('10')).toBe(1);
    expect(parseFloatFromRiskString('85')).toBe(0.85);
    expect(parseFloatFromRiskString('250')).toBe(1);
  });

  it('returns null for non-numeric / nullish input', () => {
    expect(parseFloatFromRiskString('')).toBeNull();
    expect(parseFloatFromRiskString(null)).toBeNull();
    expect(parseFloatFromRiskString(undefined)).toBeNull();
    expect(parseFloatFromRiskString('n/a')).toBeNull();
  });

  it('does NOT clamp the <=10 branch (documented quirk)', () => {
    expect(parseFloatFromRiskString('-3')).toBe(-0.3);
  });
});

describe('computeCblChipSeverity01', () => {
  it('prefers the risk string', () => {
    expect(computeCblChipSeverity01({ riskRating: '9/10', reputationPoints: null })).toBe(0.9);
    // risk wins even when reputation points are present
    expect(computeCblChipSeverity01({ riskRating: '1/10', reputationPoints: 28 })).toBe(0.1);
  });

  it('falls back to reputation points on a /28 scale', () => {
    expect(computeCblChipSeverity01({ riskRating: null, reputationPoints: 14 })).toBe(0.5);
    expect(computeCblChipSeverity01({ riskRating: null, reputationPoints: 28 })).toBe(1);
    expect(computeCblChipSeverity01({ riskRating: null, reputationPoints: 56 })).toBe(1);
  });

  it('defaults to 0.4 when neither is usable', () => {
    expect(computeCblChipSeverity01({ riskRating: null, reputationPoints: null })).toBe(0.4);
    expect(computeCblChipSeverity01({ riskRating: null, reputationPoints: NaN })).toBe(0.4);
  });
});

describe('cblHasReputationOrRiskRating', () => {
  const ok = (over: Partial<Extract<CblPayload, { kind: 'ok' }>>): CblPayload => ({
    kind: 'ok',
    reputationPoints: null,
    riskRating: null,
    reputationRank: null,
    displayName: null,
    ...over,
  });

  it('is true when reputation points are present, including 0', () => {
    expect(cblHasReputationOrRiskRating(ok({ reputationPoints: 0 }))).toBe(true);
    expect(cblHasReputationOrRiskRating(ok({ reputationPoints: 5 }))).toBe(true);
  });

  it('is true for a non-empty risk rating', () => {
    expect(cblHasReputationOrRiskRating(ok({ riskRating: '5/10' }))).toBe(true);
  });

  it('is false for empty risk / no data / non-ok payloads', () => {
    expect(cblHasReputationOrRiskRating(ok({ riskRating: '' }))).toBe(false);
    expect(cblHasReputationOrRiskRating({ kind: 'error' })).toBe(false);
    expect(cblHasReputationOrRiskRating({ kind: 'notFound' })).toBe(false);
    expect(cblHasReputationOrRiskRating(null)).toBe(false);
  });
});

describe('cblDetailParts', () => {
  it('includes RP 0 (present, not missing) and skips empty risk / null rank', () => {
    expect(cblDetailParts({ reputationPoints: 0, riskRating: '', reputationRank: null })).toEqual([
      'RP 0',
    ]);
  });

  it('assembles all present parts', () => {
    expect(cblDetailParts({ reputationPoints: 5, riskRating: '5/10', reputationRank: 42 })).toEqual(
      ['RP 5', 'Risk 5/10', '#42'],
    );
  });
});
