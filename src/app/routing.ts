import {
  CBL_PENDING_ATTR,
  PROFILE_HEADER_CBL_ATTR,
  PROFILE_OVERVIEW_ACTIONS_ATTR,
} from '../constants';
import { CblReputationService, ensureProfilePageCblService } from '../cbl/service';
import { ConnectedPlayersPanel } from '../panels/connected-players';
import { RconLiveFeed } from '../panels/live-feed';
import { ProfilePageRunner } from '../profile/scheduler';
import { SteamBanLookup } from '../steam/ban-lookup';
import { MATCHED_SERVER_PATH_RE } from '../server-config';
import { cancelSelfCheck, scheduleSelfCheck } from './self-check';
import { getFeedFilter, getHighlightRules, getPlayerFilter, setSteamBanLookup } from './state';

/**
 * Route switcher for the SPA: starts/stops the server dashboard vs the profile
 * runner based on the URL. Owns the live dashboard instances and the route
 * watcher's last-seen href (both private to this module — nothing else touches
 * lifecycle state).
 */

const bmToolkitServer: {
  players: ConnectedPlayersPanel | null;
  feed: RconLiveFeed | null;
  cbl: CblReputationService | null;
} = { players: null, feed: null, cbl: null };

/** Tear down server observers when leaving the server dashboard. */
function teardownServerDashboard(): void {
  if (bmToolkitServer.players) {
    bmToolkitServer.players.stop();
    bmToolkitServer.players = null;
  }
  if (bmToolkitServer.feed) {
    bmToolkitServer.feed.stop();
    bmToolkitServer.feed = null;
  }
  bmToolkitServer.cbl = null;
  setSteamBanLookup(null);
}

/** Start ConnectedPlayersPanel + RconLiveFeed + shared CBL/Steam services. */
function startServerDashboard(): void {
  if (bmToolkitServer.players) return;

  const cbl = new CblReputationService();
  const players = new ConnectedPlayersPanel(cbl, getHighlightRules, getPlayerFilter);
  const feed = new RconLiveFeed(getHighlightRules, getFeedFilter);

  const steamBanLookup = new SteamBanLookup();
  // Closes over this specific players panel so ban results refresh its rows.
  steamBanLookup.onUpdate = () => {
    players.refreshPlayerRowVisuals();
  };
  setSteamBanLookup(steamBanLookup);

  players.start();
  feed.start();

  bmToolkitServer.players = players;
  bmToolkitServer.feed = feed;
  bmToolkitServer.cbl = cbl;
}

/** Route switcher: profile pages vs the matched server vs everything else. */
export function applyBattlemetricsRoute(): void {
  const path = location.pathname;
  const isProfile = /\/rcon\/players\/\d+/.test(path);
  const isOurServer = MATCHED_SERVER_PATH_RE.test(path);

  if (isProfile) {
    teardownServerDashboard();
    ensureProfilePageCblService().loadCache();
    ProfilePageRunner.start();
    ProfilePageRunner.schedule();
    scheduleSelfCheck('profile');
    return;
  }

  ProfilePageRunner.stop();
  const inj = document.querySelectorAll('[' + PROFILE_HEADER_CBL_ATTR + ']');
  for (let i = 0; i < inj.length; i++) {
    const w = inj[i];
    const par = w.parentElement;
    w.remove();
    if (par && par.tagName === 'H1') {
      par.classList.remove('bss-toolkit-profile-h1-with-chip');
      par.removeAttribute(CBL_PENDING_ATTR);
    }
  }

  const copyRoots = document.querySelectorAll('[' + PROFILE_OVERVIEW_ACTIONS_ATTR + ']');
  for (let c = 0; c < copyRoots.length; c++) copyRoots[c].remove();

  if (isOurServer) {
    if (bmToolkitServer.players && bmToolkitServer.feed) {
      bmToolkitServer.players.prepareForSpaRescan();
      bmToolkitServer.feed.prepareForSpaRescan();
    } else {
      startServerDashboard();
    }
    scheduleSelfCheck('server');
  } else {
    cancelSelfCheck();
    teardownServerDashboard();
  }
}

/**
 * Watch SPA navigation. Battlemetrics uses history.pushState/replaceState, so we
 * patch both (once) plus a popstate listener and a 750ms fallback poll.
 */
export function installBattlemetricsRouteWatcher(): void {
  let routeLastHref = location.href;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function onUrlMaybeChanged(): void {
    if (location.href === routeLastHref) return;
    routeLastHref = location.href;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      try {
        applyBattlemetricsRoute();
      } catch {}
    }, 60);
  }

  window.addEventListener('popstate', onUrlMaybeChanged);

  const pushState = history.pushState;
  const replaceState = history.replaceState;
  history.pushState = function (this: History, ...args: Parameters<History['pushState']>) {
    const r = pushState.apply(this, args);
    onUrlMaybeChanged();
    return r;
  };
  history.replaceState = function (this: History, ...args: Parameters<History['replaceState']>) {
    const r = replaceState.apply(this, args);
    onUrlMaybeChanged();
    return r;
  };

  setInterval(() => {
    if (location.href !== routeLastHref) onUrlMaybeChanged();
  }, 750);
}
