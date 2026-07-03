import { applyBattlemetricsRoute, installBattlemetricsRouteWatcher } from './app/routing';
import { CssInjector } from './dom/css';
import { PlayerProfileCblLink } from './profile/header-cbl';
import { PlayerProfileOverviewUi } from './profile/overview-ui';
import { ProfilePageRunner } from './profile/scheduler';

/**
 * BM RCON Buddy — userscript entry point (the only module with top-level side
 * effects). Wires the profile-page tasks explicitly, injects CSS, patches the
 * SPA route watcher, then runs the initial route.
 */

// Order matters: the CBL header chip must mount before the Overview UI reads the
// h1 layout (this replaces the original's import-time ProfilePageRunner.register).
function wireProfileTasks(): void {
  ProfilePageRunner.register(() => PlayerProfileCblLink.run());
  ProfilePageRunner.register(() => PlayerProfileOverviewUi.run());
}

function initBattlemetricsToolkit(): void {
  wireProfileTasks();
  CssInjector.inject();
  installBattlemetricsRouteWatcher();
  applyBattlemetricsRoute(); // initial page
}

// Boot when DOM is ready (Tampermonkey @run-at defaults to document-idle).
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBattlemetricsToolkit);
} else {
  initBattlemetricsToolkit();
}
