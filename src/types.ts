/**
 * Shared data shapes. Ported from the JSDoc `@typedef`s in the original monolith.
 */

/** A parsed connected-player row from the server dashboard (`div[data-session]`). */
export interface ParsedPlayerRow {
  steamId64: string;
  displayName: string;
  roleText: string;
  teamText: string;
  squadText: string;
  badgeTitles: string[];
  hasPlayerNote: boolean;
  rowEl: HTMLElement;
}

/** One visual effect applied by a matched {@link HighlightRule}. */
export interface HighlightAction {
  type: string;
  className?: string;
  borderColor?: string;
}

/** A user-configurable (or built-in) highlight rule for player rows / feed lines. */
export interface HighlightRule {
  id: string;
  enabled: boolean;
  feedLineMatches?: string;
  textMatches?: string;
  steamIdInList?: string[];
  teamEquals?: string | null;
  roleMatches?: string;
  badgeTitleContains?: string;
  actions: HighlightAction[];
}

/** Result of a Steam ban lookup; `null` from callers means "lookup disabled". */
export interface SteamBanSnapshot {
  loading: boolean;
  vacOrGameBan?: boolean;
}

/** The reputation fields CBL returns for a Steam user. */
export interface CblRatingData {
  reputationPoints: number | null;
  riskRating: string | null;
  reputationRank: number | null;
  displayName: string | null;
}

/** CBL GraphQL response mapped into a discriminated union (see `mapCblResponse`). */
type CblOkPayload = { kind: 'ok' } & CblRatingData;
export type CblPayload = { kind: 'error' } | { kind: 'notFound' } | CblOkPayload;

/** Callback used by the CBL and Steam queues. */
export type CblWaiter = (err: unknown, data: CblPayload | null) => void;
