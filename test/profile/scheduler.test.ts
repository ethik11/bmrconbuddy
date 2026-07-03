import { describe, it, expect, vi, afterEach } from 'vitest';
import { ProfilePageRunner } from '../../src/profile/scheduler';

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
    expect(document.querySelector('time')?.getAttribute('data-bss-ts-title')).toBe('1');
  });

  it('does nothing off a profile route', () => {
    setPath('/rcon/servers/34935347');
    const task = vi.fn();
    ProfilePageRunner.register(task);
    ProfilePageRunner.runAll();
    expect(task).not.toHaveBeenCalled();
  });
});
