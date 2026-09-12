import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RconLiveFeed } from '../../src/panels/live-feed';
import { DEFAULT_RULES, TS_TITLE_ATTR } from '../../src/constants';
import { getFeedMessageElement } from '../../src/dom/parsing';
import type { HighlightRule } from '../../src/types';

function mountFeedLine(text: string): HTMLElement {
  const line = document.createElement('div');
  line.innerHTML = `<time datetime="2026-01-01T00:00:00Z"></time><div>${text}</div>`;
  document.body.appendChild(line);
  return line;
}

describe('RconLiveFeed (integration)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => vi.useRealTimers());

  it('colors the message, applies the highlight rule, and tooltips the timestamp', () => {
    const line = mountFeedLine('Player XYZ was kicked');
    new RconLiveFeed(
      () => DEFAULT_RULES,
      () => '',
    ).reconcileAll();

    const msg = getFeedMessageElement(line)!;
    expect(msg.style.color).not.toBe(''); // phrase color applied ("was kicked" -> mod-action red)
    expect(line.classList.contains('bss-toolkit-feed-kick')).toBe(true); // DEFAULT_RULES feed-kick
    expect(line.querySelector('time')?.getAttribute(TS_TITLE_ATTR)).toBe('2026-01-01T00:00:00Z');
  });

  it('dims feed lines that do not match the feed filter', () => {
    const line = mountFeedLine('map changed');
    new RconLiveFeed(
      () => [],
      () => 'zzz-no-match',
    ).reconcileAll();
    expect(line.classList.contains('bss-toolkit-feed-filtered')).toBe(true);
  });

  it('refreshes a recycled line on the existing 300ms reconciliation interval', async () => {
    vi.useFakeTimers();
    const line = mountFeedLine('Player was kicked');
    const message = getFeedMessageElement(line)!;
    const time = line.querySelector('time')!;
    const feed = new RconLiveFeed(
      () => DEFAULT_RULES,
      () => '',
    );
    feed.start();
    try {
      message.firstChild!.textContent = 'Player connected';
      time.dateTime = '2026-02-01T00:00:00Z';
      await vi.advanceTimersByTimeAsync(300);

      expect(message.style.color).toBe('');
      expect(line.classList.contains('bss-toolkit-feed-kick')).toBe(false);
      expect(time.title).toBe(
        new Date(time.dateTime).toLocaleString(undefined, { timeZoneName: 'short' }),
      );
    } finally {
      feed.stop();
    }
  });

  it('restores the original message color when no phrase matches', () => {
    const line = mountFeedLine('Player was kicked');
    const message = getFeedMessageElement(line)!;
    message.style.setProperty('color', 'blue', 'important');
    const feed = new RconLiveFeed(
      () => DEFAULT_RULES,
      () => '',
    );
    feed.reconcileAll();
    feed.reconcileAll();
    message.textContent = 'Player connected';
    feed.reconcileAll();

    expect(message.style.color).toBe('blue');
    expect(message.style.getPropertyPriority('color')).toBe('important');
  });

  it('preserves a newer host color when the message becomes empty', () => {
    const line = mountFeedLine('Player was kicked');
    const message = getFeedMessageElement(line)!;
    const feed = new RconLiveFeed(
      () => DEFAULT_RULES,
      () => '',
    );
    feed.reconcileAll();
    message.style.color = 'purple';
    message.textContent = '';
    feed.reconcileAll();
    expect(message.style.color).toBe('purple');
  });

  it('uses the supplied rules throughout reconciliation and removes disabled effects', () => {
    const line = mountFeedLine('Player connected');
    const rules: HighlightRule[] = [
      {
        id: 'custom',
        enabled: true,
        feedLineMatches: 'connected',
        actions: [
          { type: 'setRowClass', className: 'custom-rule' },
          { type: 'setBorderColor', borderColor: 'red' },
        ],
      },
    ];
    const feed = new RconLiveFeed(
      () => rules,
      () => '',
    );
    feed.reconcileAll();
    expect(line.classList.contains('custom-rule')).toBe(true);
    expect(line.style.borderLeftColor).toBe('red');

    rules[0].enabled = false;
    feed.reconcileAll();
    expect(line.classList.contains('custom-rule')).toBe(false);
    expect(line.style.borderLeft).toBe('');
  });

  it.each(['', 'not-a-date', 'PT37M33S'])(
    'clears a stale tooltip for datetime "%s"',
    (dateTime) => {
      const line = mountFeedLine('Player connected');
      const feed = new RconLiveFeed(
        () => [],
        () => '',
      );
      feed.reconcileAll();
      const time = line.querySelector('time')!;
      time.dateTime = dateTime;
      feed.reconcileAll();
      expect(time.hasAttribute('title')).toBe(false);
      expect(time.hasAttribute(TS_TITLE_ATTR)).toBe(false);
    },
  );
});
