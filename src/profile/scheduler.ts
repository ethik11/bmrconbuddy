import { AdminTagNameStyler } from '../players/admin-tag';
import { FeedColorEnhancer } from '../feed/enhancer';
import { findProfileActivityLogRoot } from './identifiers';

/**
 * One MutationObserver (50ms debounce) runs registered profile-page tasks and the
 * activity-log colors. A 300ms interval re-applies colors on the virtual-scrolled
 * activity log. Task registration happens explicitly in main.ts (not at import
 * time) so ordering is visible and this module stays free of the task modules.
 */
export const ProfilePageRunner = {
  observer: null as MutationObserver | null,
  timer: null as ReturnType<typeof setTimeout> | null,
  colorInterval: null as ReturnType<typeof setInterval> | null,
  tasks: [] as Array<() => void>,

  register(fn: () => void): void {
    this.tasks.push(fn);
  },

  reconcileActivityLog(): void {
    if (!/\/rcon\/players\/\d+/.test(location.pathname)) return;
    FeedColorEnhancer.reconcileDocument({
      scopeRoot: findProfileActivityLogRoot(),
      applyHighlightRules: true,
    });
  },

  runAll(): void {
    if (!/\/rcon\/players\/\d+/.test(location.pathname)) return;
    for (let i = 0; i < this.tasks.length; i++) {
      try {
        this.tasks[i]();
      } catch {}
    }
    this.reconcileActivityLog();
    AdminTagNameStyler.applyToProfileHeader();
  },

  schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.runAll();
    }, 50);
  },

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.colorInterval) {
      clearInterval(this.colorInterval);
      this.colorInterval = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  },

  start(): void {
    if (this.observer) return;
    if (this.colorInterval) clearInterval(this.colorInterval);
    this.colorInterval = setInterval(() => {
      this.reconcileActivityLog();
    }, 300);
    this.runAll();
    this.observer = new MutationObserver(() => {
      this.schedule();
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  },
};
