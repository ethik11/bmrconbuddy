import type { CblPayload, CblRatingData } from '../types';

/**
 * CBL chip severity math (pure). Higher severity = worse = more red.
 * Ported verbatim from the monolith; the `!= null` checks are deliberate
 * (they treat `0` reputation and `""` risk as "present", not missing).
 */

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Normalize a CBL risk string to 0..1. Note: the `n <= 10` branch is intentionally
 * NOT clamped, so a negative input like `"-3"` yields `-0.3` (preserved behavior).
 */
export function parseFloatFromRiskString(s: string | null | undefined): number | null {
  if (s == null) return null;
  const str = String(s);
  const m = str.match(/([\d.]+)\s*\/\s*10/i);
  if (m) return parseFloat(m[1]) / 10;
  const n = parseFloat(str);
  if (Number.isNaN(n)) return null;
  if (n <= 10) return n / 10;
  return clamp01(n / 100);
}

/** Prefers the CBL risk string; falls back to reputation points on a /28 scale. */
export function computeCblChipSeverity01(
  data: Pick<CblRatingData, 'reputationPoints' | 'riskRating'>,
): number {
  const rr = parseFloatFromRiskString(data.riskRating);
  if (rr != null) return clamp01(rr);
  const rp = data.reputationPoints;
  if (rp != null && !Number.isNaN(Number(rp))) return clamp01(Number(rp) / 28);
  return 0.4;
}

/** Chip is only shown when CBL returns at least one of reputation points or risk rating. */
export function cblHasReputationOrRiskRating(data: CblPayload | null | undefined): boolean {
  if (!data || data.kind !== 'ok') return false;
  if (data.reputationPoints != null && !Number.isNaN(Number(data.reputationPoints))) return true;
  if (data.riskRating != null && String(data.riskRating).trim() !== '') return true;
  return false;
}

/** Full CBL line for tooltips / profile chip label. */
export function cblDetailParts(
  data: Pick<CblRatingData, 'reputationPoints' | 'riskRating' | 'reputationRank'>,
): string[] {
  const parts: string[] = [];
  if (data.reputationPoints != null) parts.push('RP ' + data.reputationPoints);
  if (data.riskRating != null && String(data.riskRating).trim() !== '') {
    parts.push('Risk ' + data.riskRating);
  }
  if (data.reputationRank != null) parts.push('#' + data.reputationRank);
  return parts;
}
