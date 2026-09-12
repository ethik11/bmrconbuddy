import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  SERVER_ACCENT_CLASS,
  SERVER_ACCENT_VAR,
  SERVER_H1_WITH_PILL_CLASS,
  SERVER_IDENTITY_ATTR,
} from '../../src/constants';
import { applyServerIdentity, clearServerIdentity } from '../../src/app/server-identity';

function setPath(path: string): void {
  window.history.pushState({}, '', path);
}

afterEach(() => {
  clearServerIdentity();
  vi.useRealTimers();
  document.body.innerHTML = '';
  setPath('/');
});

describe('applyServerIdentity', () => {
  it('paints the teal bar and NL #1 pill on the known beginner server', () => {
    setPath('/rcon/servers/34935347');
    document.body.innerHTML = '<h1>Northern Lights #1</h1>';

    applyServerIdentity();

    const root = document.documentElement;
    expect(root.classList.contains(SERVER_ACCENT_CLASS)).toBe(true);
    expect(root.style.getPropertyValue(SERVER_ACCENT_VAR)).toBe('#2dd4bf');

    const pill = document.querySelector('[' + SERVER_IDENTITY_ATTR + ']');
    expect(pill?.textContent).toBe('NL #1');
    expect(pill?.getAttribute(SERVER_IDENTITY_ATTR)).toBe('34935347');
    expect(document.querySelector('h1')?.classList.contains(SERVER_H1_WITH_PILL_CLASS)).toBe(true);
  });

  it('updates the chrome when switching from NL #1 to NL #2', () => {
    setPath('/rcon/servers/34935347');
    document.body.innerHTML = '<h1>Northern Lights #1</h1>';
    applyServerIdentity();

    setPath('/rcon/servers/40375266');
    document.body.innerHTML = '<h1>Northern Lights #2</h1>';
    applyServerIdentity();

    expect(document.documentElement.style.getPropertyValue(SERVER_ACCENT_VAR)).toBe('#fbbf24');
    const pills = document.querySelectorAll('[' + SERVER_IDENTITY_ATTR + ']');
    expect(pills).toHaveLength(1);
    expect(pills[0].textContent).toBe('NL #2');
  });

  it('keeps a slate bar and no named pill on an unknown server', () => {
    setPath('/rcon/servers/11111111');
    document.body.innerHTML = '<h1>Some Other Server</h1>';

    applyServerIdentity();

    expect(document.documentElement.classList.contains(SERVER_ACCENT_CLASS)).toBe(true);
    expect(document.documentElement.style.getPropertyValue(SERVER_ACCENT_VAR)).toBe('#64748b');
    expect(document.querySelector('[' + SERVER_IDENTITY_ATTR + ']')).toBeNull();
  });

  it('retries the pill once after 400ms if the dashboard h1 is not ready', () => {
    vi.useFakeTimers();
    setPath('/rcon/servers/34935347');
    document.body.innerHTML = '';

    applyServerIdentity();
    expect(document.querySelector('[' + SERVER_IDENTITY_ATTR + ']')).toBeNull();
    expect(document.documentElement.classList.contains(SERVER_ACCENT_CLASS)).toBe(true);

    document.body.innerHTML = '<h1>Northern Lights #1</h1>';
    vi.advanceTimersByTime(400);

    expect(document.querySelector('[' + SERVER_IDENTITY_ATTR + ']')?.textContent).toBe('NL #1');
  });
});

describe('clearServerIdentity', () => {
  it('removes the bar, CSS variable, and pill', () => {
    setPath('/rcon/servers/34935347');
    document.body.innerHTML = '<h1>Northern Lights #1</h1>';
    applyServerIdentity();

    clearServerIdentity();

    expect(document.documentElement.classList.contains(SERVER_ACCENT_CLASS)).toBe(false);
    expect(document.documentElement.style.getPropertyValue(SERVER_ACCENT_VAR)).toBe('');
    expect(document.querySelector('[' + SERVER_IDENTITY_ATTR + ']')).toBeNull();
    expect(document.querySelector('h1')?.classList.contains(SERVER_H1_WITH_PILL_CLASS)).toBe(false);
  });
});
