import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GM_xmlhttpRequest } from '$';
import * as gm from '../mocks/gm';
import { CblReputationService } from '../../src/cbl/service';

type RequestOptions = Parameters<typeof GM_xmlhttpRequest>[0];
type LoadResponse = Parameters<NonNullable<RequestOptions['onload']>>[0];
const STEAM = '76561190000000001';

function respondWith(status: number, responseText: string) {
  return vi.spyOn(gm, 'GM_xmlhttpRequest').mockImplementation((details) => {
    const request = details as RequestOptions;
    const response = { status, responseText } as LoadResponse;
    request.onload?.call(response, response);
  });
}

describe('CBL HTTP responses through the reputation service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    gm.__resetGmStore();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    gm.__resetGmStore();
  });

  it.each([429, 503])(
    'retries HTTP %s errors instead of caching a missing player',
    async (status) => {
      const request = respondWith(status, '{"message":"temporarily unavailable"}');
      const service = new CblReputationService();
      const callback = vi.fn();
      service.enqueue(STEAM, callback);
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalledWith(expect.any(Error), null);
      expect(service.getCached(STEAM)).toBeNull();
      service.enqueue(STEAM, vi.fn());
      await vi.runAllTimersAsync();
      expect(request).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    { data: { steamUser: null } },
    {
      data: {
        steamUser: { name: 'Player', reputationPoints: 5, riskRating: '5/10', reputationRank: 1 },
      },
    },
  ])('still caches a successful GraphQL response: %j', async (body) => {
    const request = respondWith(200, JSON.stringify(body));
    const service = new CblReputationService();
    const callback = vi.fn();
    service.enqueue(STEAM, callback);
    await vi.runAllTimersAsync();
    service.enqueue(STEAM, callback);

    expect(request).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(service.getCached(STEAM)?.kind).toBe(body.data.steamUser ? 'ok' : 'notFound');
  });

  it('does not cache an invalid JSON response', async () => {
    respondWith(200, '<html>gateway error</html>');
    const service = new CblReputationService();
    const callback = vi.fn();
    service.enqueue(STEAM, callback);
    await vi.runAllTimersAsync();
    expect(callback).toHaveBeenCalledWith(expect.any(Error), null);
    expect(service.getCached(STEAM)).toBeNull();
  });
});
