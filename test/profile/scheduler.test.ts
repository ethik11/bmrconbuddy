import { describe, it, expect, vi, afterEach } from 'vitest';
import { ProfilePageRunner } from '../../src/profile/scheduler';
import { TS_TITLE_ATTR } from '../../src/constants';

function setPath(path: string): void {
  window.history.pushState({}, '', path);
}

afterEach(() => {
  ProfilePageRunner.tasks.length = 0;
  setPath('/');
});

describe('ProfilePageRunner.runAll (integration)', () => {
  it('runs registered tasks, colors the header name, and tooltips the activity log', () => {
    setPath('/rcon/players/123/overview');
    document.body.innerHTML =
      '<main>' +
      '<h1 class="css-8uhtka"><a href="/rcon/players/123">Name</a></h1>' +
      '<span title="NL Squad Admin"></span>' +
      '<div><time datetime="2026-01-01T00:00:00Z"></time><div>Player was kicked</div></div>' +
      '</main>';

    const task = vi.fn();
    ProfilePageRunner.register(task);
    ProfilePageRunner.runAll();

    expect(task).toHaveBeenCalledTimes(1);
    expect(document.querySelector('h1 a')?.classList.contains('bss-toolkit-admin-tag-name')).toBe(
      true,
    );
    expect(document.querySelector('time')?.getAttribute(TS_TITLE_ATTR)).toBe(
      '2026-01-01T00:00:00Z',
    );
  });

  it('does nothing off a profile route', () => {
    setPath('/rcon/servers/34935347');
    const task = vi.fn();
    ProfilePageRunner.register(task);
    ProfilePageRunner.runAll();
    expect(task).not.toHaveBeenCalled();
  });

  it('refreshes a reused activity-log line on a profile page', () => {
    setPath('/rcon/players/123/overview');
    document.body.innerHTML =
      '<main><div><time datetime="2026-01-01T00:00:00Z"></time><div>Player was kicked</div></div></main>';
    ProfilePageRunner.reconcileActivityLog();
    const time = document.querySelector('time')!;
    const line = time.parentElement!;
    const message = time.nextElementSibling as HTMLElement;
    message.textContent = 'Player connected';
    time.dateTime = '2026-02-01T00:00:00Z';
    ProfilePageRunner.reconcileActivityLog();

    expect(message.style.color).toBe('');
    expect(line.classList.contains('bss-toolkit-feed-kick')).toBe(false);
    expect(time.title).toBe(
      new Date(time.dateTime).toLocaleString(undefined, { timeZoneName: 'short' }),
    );
  });
});
