import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scheduleSelfCheck, cancelSelfCheck } from '../../src/app/self-check';

describe('scheduleSelfCheck', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cancelSelfCheck();
    warnSpy.mockRestore();
    vi.useRealTimers();
  });

  it('warns once (deduped) when the profile heading is missing', () => {
    scheduleSelfCheck('profile');
    vi.advanceTimersByTime(4000);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toBe('[BM RCON Buddy]');

    // A second check for the same issue does not warn again.
    scheduleSelfCheck('profile');
    vi.advanceTimersByTime(4000);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when the profile hooks are present', () => {
    document.body.innerHTML =
      '<h1><a href="/rcon/players/1">Name</a></h1>' +
      '<table><tbody><tr><td data-title="Type">Steam ID</td>' +
      '<td data-title="Identifier"><span title="76561190000000001">x</span></td></tr></tbody></table>';
    scheduleSelfCheck('profile');
    vi.advanceTimersByTime(4000);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns when the server dashboard has neither rows nor a feed', () => {
    scheduleSelfCheck('server');
    vi.advanceTimersByTime(4000);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('stays quiet on an empty server that still renders a feed', () => {
    document.body.innerHTML = '<time datetime="2026-01-01T00:00:00Z"></time>';
    scheduleSelfCheck('server');
    vi.advanceTimersByTime(4000);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('can be cancelled before it fires', () => {
    scheduleSelfCheck('server');
    cancelSelfCheck();
    vi.advanceTimersByTime(4000);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
