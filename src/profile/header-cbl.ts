import { CBL_PENDING_ATTR, PROFILE_HEADER_CBL_ATTR, PROFILE_PATH_ATTR } from '../constants';
import { CblRatingChip } from '../cbl/chip';
import { ensureProfilePageCblService } from '../cbl/service';
import { extractSteamId64FromProfileIdentifiers, findProfilePageH1 } from './identifiers';

/** Same CBL chip as the player list, placed in the profile page header (beside h1). */
export const PlayerProfileCblLink = {
  removeStaleInjections(): void {
    const nodes = document.querySelectorAll('[' + PROFILE_HEADER_CBL_ATTR + ']');
    for (let i = 0; i < nodes.length; i++) {
      const p = nodes[i].getAttribute(PROFILE_PATH_ATTR);
      if (p && p !== location.pathname) {
        const par = nodes[i].parentElement;
        nodes[i].remove();
        if (par && par.tagName === 'H1') {
          par.classList.remove('bss-toolkit-profile-h1-with-chip');
          par.removeAttribute(CBL_PENDING_ATTR);
        }
      }
    }
  },

  run(): void {
    if (!/\/rcon\/players\/\d+/.test(location.pathname)) return;

    this.removeStaleInjections();

    const h1 = findProfilePageH1();
    if (!h1) return;

    const existing = h1.querySelector('[' + PROFILE_HEADER_CBL_ATTR + ']');
    if (existing && existing.getAttribute(PROFILE_PATH_ATTR) === location.pathname) return;
    if (h1.getAttribute(CBL_PENDING_ATTR) === location.pathname) return;

    const steamId = extractSteamId64FromProfileIdentifiers();
    if (!steamId) return;

    CblRatingChip.mountInHeader(h1, steamId, ensureProfilePageCblService());
  },
};
