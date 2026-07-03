import { FEED_PROCESSED_ATTR } from '../constants';
import {
  getFeedLineText,
  getFeedMessageElement,
  isFeedLineStructure,
  isRconFeedLine,
  resolveFeedLineContainer,
  stripBssToolkitClassesFromElement,
} from '../dom/parsing';
import { FeedTextColorEngine } from '../feed/colors';
import { FeedColorEnhancer } from '../feed/enhancer';
import { HighlightRuleEngine } from '../highlight/rules';
import { matchesFilter } from '../players/filter';
import type { HighlightRule } from '../types';

/**
 * Server dashboard feed: phrase colors, highlight rules, optional text filter.
 * A 300ms interval reconcile handles virtual-scroll row recycling.
 */
export class RconLiveFeed {
  private observer: MutationObserver | null = null;
  private reconcileInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly getRules: () => HighlightRule[],
    private readonly getFeedFilter: () => string,
  ) {}

  private applyFeedEnhancements(lineEl: HTMLElement): void {
    if (!isFeedLineStructure(lineEl)) return;
    FeedTextColorEngine.applyToLine(lineEl);
  }

  processLine(lineEl: HTMLElement): void {
    if (!isRconFeedLine(lineEl)) return;
    lineEl.setAttribute(FEED_PROCESSED_ATTR, '1');

    const text = getFeedLineText(lineEl);
    HighlightRuleEngine.applyFeed(this.getRules(), lineEl, text);
    this.applyFeedFilter(lineEl, text);
    this.applyFeedEnhancements(lineEl);
  }

  reconcileAll(): void {
    const times = document.querySelectorAll('time');
    for (let i = 0; i < times.length; i++) {
      const lineEl = resolveFeedLineContainer(times[i].parentElement);
      if (lineEl && isRconFeedLine(lineEl)) this.processLine(lineEl);
    }
    FeedColorEnhancer.reconcileDocument({
      applyHighlightRules: true,
      applyFeedFilter: true,
      feedFilterFn: (lineEl, text) => this.applyFeedFilter(lineEl, text),
      applyModalStyles: true,
    });
  }

  applyFeedFilter(lineEl: HTMLElement, text: string): void {
    const visible = matchesFilter(text, this.getFeedFilter());
    lineEl.classList.toggle('bss-toolkit-feed-filtered', !visible);
  }

  scan(): void {
    const times = document.querySelectorAll('time');
    for (let i = 0; i < times.length; i++) {
      const lineEl = resolveFeedLineContainer(times[i].parentElement);
      if (lineEl && isRconFeedLine(lineEl)) this.processLine(lineEl);
    }
  }

  private stripLineDecoration(lineEl: HTMLElement): void {
    lineEl.removeAttribute(FEED_PROCESSED_ATTR);
    stripBssToolkitClassesFromElement(lineEl);
    const msg = getFeedMessageElement(lineEl);
    if (msg) msg.style.color = '';
  }

  prepareForSpaRescan(): void {
    const marked = document.querySelectorAll<HTMLElement>('div[' + FEED_PROCESSED_ATTR + ']');
    for (let i = 0; i < marked.length; i++) this.stripLineDecoration(marked[i]);
    this.scan();
  }

  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.reconcileInterval) {
      clearInterval(this.reconcileInterval);
      this.reconcileInterval = null;
    }
  }

  start(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.reconcileInterval) {
      clearInterval(this.reconcileInterval);
      this.reconcileInterval = null;
    }

    this.scan();
    this.reconcileAll();
    this.reconcileInterval = setInterval(() => this.reconcileAll(), 300);

    this.observer = new MutationObserver((mutations) => {
      for (let m = 0; m < mutations.length; m++) {
        const mu = mutations[m];
        for (let j = 0; j < mu.addedNodes.length; j++) {
          const n = mu.addedNodes[j];
          if (n.nodeType !== 1) continue;
          if (isRconFeedLine(n)) this.processLine(n);
          // Resolve from each added <time> up to its feed row (handles the
          // <span><time></span><div> layout where the row is an ancestor).
          const innerTimes = (n as Element).querySelectorAll('time');
          for (let k = 0; k < innerTimes.length; k++) {
            const lineEl = resolveFeedLineContainer(innerTimes[k].parentElement);
            if (lineEl && isRconFeedLine(lineEl)) this.processLine(lineEl);
          }
        }
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }
}
