import { getHighlightRules } from '../app/state';
import { TS_TITLE_ATTR } from '../constants';
import { getFeedLineText, resolveFeedLineContainer } from '../dom/parsing';
import { HighlightRuleEngine } from '../highlight/rules';
import { FeedTextColorEngine } from './colors';

/**
 * Shared feed styling for the server live feed and the profile activity log:
 * phrase colors, local-timezone tooltips, and (server) modal colors. Hybrid
 * update: a MutationObserver handles new lines; callers reconcile on an interval
 * for virtual scroll.
 */

/** Local-timezone tooltip on `<time datetime>` elements. */
const FeedTimestampEnhancer = {
  applyToTime(timeEl: Element): void {
    if (!timeEl || timeEl.tagName !== 'TIME') return;
    if (timeEl.getAttribute(TS_TITLE_ATTR)) return;
    const raw = timeEl.getAttribute('datetime');
    if (!raw) return;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return;
    timeEl.setAttribute('title', d.toLocaleString(undefined, { timeZoneName: 'short' }));
    timeEl.setAttribute(TS_TITLE_ATTR, '1');
  },
};

interface ModalRule {
  phrase: string;
  styles: Record<string, string>;
}

/** Warn/Kick/Layer dialog + squad command menu colors (emotion-class selectors). */
const ServerModalStyler = {
  modalTitleRules: [
    {
      phrase: 'Change Layer',
      styles: { color: 'red', fontWeight: 'bold', textAlign: 'center', fontSize: '100pt' },
    },
    {
      phrase: 'Set Next Layer',
      styles: { color: 'lime', fontWeight: 'bold', textAlign: 'center', fontSize: '50pt' },
    },
    {
      phrase: 'Kick',
      styles: { color: 'orange', fontWeight: 'bold', textAlign: 'center', fontSize: '48pt' },
    },
    {
      phrase: 'Warn',
      styles: { color: 'lime', fontWeight: 'bold', textAlign: 'center', fontSize: '24pt' },
    },
  ] as ModalRule[],
  menuRulesA: [
    { phrase: 'Warn', styles: { color: 'lime' } },
    { phrase: 'Squad List', styles: { color: 'gold' } },
    { phrase: 'Kick', styles: { color: 'orange' } },
    { phrase: 'Ban', styles: { color: 'red' } },
  ] as ModalRule[],
  menuRulesB: [
    { phrase: 'Ban', styles: { color: 'red' } },
    { phrase: 'Next Layer', styles: { color: 'lime', fontSize: '16pt' } },
    { phrase: 'Change Layer', styles: { color: 'red', fontWeight: 'bold', fontSize: '8pt' } },
    { phrase: 'Squad List', styles: { color: 'gold', fontSize: '16pt' } },
  ] as ModalRule[],

  applyRules(nodes: NodeListOf<Element>, rules: ModalRule[]): void {
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i] as HTMLElement;
      const txt = el.textContent || '';
      for (let r = 0; r < rules.length; r++) {
        if (txt.indexOf(rules[r].phrase) !== -1) {
          Object.assign(el.style, rules[r].styles);
        }
      }
    }
  },

  apply(): void {
    this.applyRules(document.querySelectorAll('.modal-title'), this.modalTitleRules);
    this.applyRules(
      document.querySelectorAll('.css-f5o5h6 a, .css-f5o5h6 button'),
      this.menuRulesA,
    );
    this.applyRules(
      document.querySelectorAll('.css-1ixz43s a, .css-1ixz43s button'),
      this.menuRulesA,
    );
    this.applyRules(
      document.querySelectorAll('.css-yun63y a, .css-yun63y button'),
      this.menuRulesB,
    );
  },
};

export interface ReconcileOptions {
  scopeRoot?: ParentNode;
  applyHighlightRules?: boolean;
  applyFeedFilter?: boolean;
  feedFilterFn?: (lineEl: HTMLElement, text: string) => void;
  applyModalStyles?: boolean;
}

export const FeedColorEnhancer = {
  reconcileDocument(options: ReconcileOptions = {}): void {
    const root = options.scopeRoot || document;

    const times = root.querySelectorAll('time');
    for (let i = 0; i < times.length; i++) {
      // BM may wrap <time> in a <span>, so resolve up to the real feed row.
      const lineEl = resolveFeedLineContainer(times[i].parentElement);
      if (lineEl) {
        FeedTextColorEngine.applyToLine(lineEl);
        const text = getFeedLineText(lineEl);
        if (options.applyHighlightRules) {
          HighlightRuleEngine.applyFeed(getHighlightRules(), lineEl, text);
        }
        if (options.applyFeedFilter && options.feedFilterFn) {
          options.feedFilterFn(lineEl, text);
        }
      }
      FeedTimestampEnhancer.applyToTime(times[i]);
    }

    if (options.applyModalStyles) ServerModalStyler.apply();
  },
};
