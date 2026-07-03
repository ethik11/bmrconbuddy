import { describe, it, expect, beforeEach } from 'vitest';
import { RconLiveFeed } from '../../src/panels/live-feed';
import { DEFAULT_RULES } from '../../src/constants';
import { getFeedMessageElement } from '../../src/dom/parsing';

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

  it('colors the message, applies the highlight rule, and tooltips the timestamp', () => {
    const line = mountFeedLine('Player XYZ was kicked');
    new RconLiveFeed(
      () => DEFAULT_RULES,
      () => '',
    ).reconcileAll();

    const msg = getFeedMessageElement(line)!;
    expect(msg.style.color).not.toBe(''); // phrase color applied ("was kicked" -> mod-action red)
    expect(line.classList.contains('bss-toolkit-feed-kick')).toBe(true); // DEFAULT_RULES feed-kick
    expect(line.querySelector('time')?.getAttribute('data-bss-ts-title')).toBe('1');
  });

  it('dims feed lines that do not match the feed filter', () => {
    const line = mountFeedLine('map changed');
    new RconLiveFeed(
      () => [],
      () => 'zzz-no-match',
    ).reconcileAll();
    expect(line.classList.contains('bss-toolkit-feed-filtered')).toBe(true);
  });
});
