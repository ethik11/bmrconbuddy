import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CblReputationService } from '../../src/cbl/service';
import { CblGraphqlClient } from '../../src/cbl/graphql';

describe('CblReputationService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('fetches once for concurrent waiters, then serves the cache', async () => {
    const spy = vi.spyOn(CblGraphqlClient, 'fetchSteamUser').mockResolvedValue({
      data: {
        steamUser: { name: 'X', reputationPoints: 5, riskRating: '5/10', reputationRank: 1 },
      },
    });

    const svc = new CblReputationService();
    const a = vi.fn();
    const b = vi.fn();
    svc.enqueue('765', a);
    svc.enqueue('765', b); // deduped into the same in-flight fetch

    await vi.runAllTimersAsync();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ kind: 'ok', reputationPoints: 5 }),
    );
    expect(b).toHaveBeenCalledWith(null, expect.objectContaining({ kind: 'ok' }));

    // A later request for the same id is served from cache (no new fetch).
    const c = vi.fn();
    svc.enqueue('765', c);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(c).toHaveBeenCalledWith(null, expect.objectContaining({ kind: 'ok' }));
  });

  it('reports the error to waiters without caching it', async () => {
    const spy = vi
      .spyOn(CblGraphqlClient, 'fetchSteamUser')
      .mockRejectedValue(new Error('network'));

    const svc = new CblReputationService();
    const cb = vi.fn();
    svc.enqueue('765', cb);
    await vi.runAllTimersAsync();

    expect(cb).toHaveBeenCalledWith(expect.any(Error), null);

    // Not cached: a second request tries again.
    svc.enqueue('765', vi.fn());
    await vi.runAllTimersAsync();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
