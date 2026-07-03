import { describe, it, expect } from 'vitest';
import { mapCblResponse } from '../../src/cbl/graphql';

describe('mapCblResponse', () => {
  it('maps nullish / error responses to kind "error"', () => {
    expect(mapCblResponse(null)).toEqual({ kind: 'error' });
    expect(mapCblResponse({ errors: [{ message: 'boom' }] })).toEqual({ kind: 'error' });
  });

  it('maps a missing steamUser to kind "notFound"', () => {
    expect(mapCblResponse({ data: { steamUser: null } })).toEqual({ kind: 'notFound' });
    expect(mapCblResponse({ data: {} })).toEqual({ kind: 'notFound' });
  });

  it('maps a full user, coercing types', () => {
    expect(
      mapCblResponse({
        data: {
          steamUser: { name: 'X', reputationPoints: 5, riskRating: '5/10', reputationRank: 42 },
        },
      }),
    ).toEqual({
      kind: 'ok',
      reputationPoints: 5,
      riskRating: '5/10',
      reputationRank: 42,
      displayName: 'X',
    });

    expect(
      mapCblResponse({
        data: { steamUser: { name: 5, reputationPoints: '7', riskRating: 3, reputationRank: '9' } },
      }),
    ).toEqual({
      kind: 'ok',
      reputationPoints: 7,
      riskRating: '3',
      reputationRank: 9,
      displayName: '5',
    });
  });

  it('keeps 0 reputation and empty risk as present (not null)', () => {
    expect(
      mapCblResponse({
        data: {
          steamUser: { name: null, reputationPoints: 0, riskRating: '', reputationRank: null },
        },
      }),
    ).toEqual({
      kind: 'ok',
      reputationPoints: 0,
      riskRating: '',
      reputationRank: null,
      displayName: null,
    });
  });
});
