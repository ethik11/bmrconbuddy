import {
  CBL_FOR_ATTR,
  CBL_PENDING_ATTR,
  PROFILE_HEADER_CBL_ATTR,
  PROFILE_PATH_ATTR,
  cblSearchUrl,
} from '../constants';
import { cblDetailParts, cblHasReputationOrRiskRating, computeCblChipSeverity01 } from './severity';
import type { CblPayload, CblRatingData } from '../types';
import type { CblReputationService } from './service';

/** Gradient CBL chip from RP/risk severity. Compact label on the player list, full on profile. */

function applyCblChipSeverityStyles(
  chip: HTMLAnchorElement,
  data: Pick<CblRatingData, 'reputationPoints' | 'riskRating'>,
): void {
  const sev = computeCblChipSeverity01(data);
  const hue = Math.round(118 * (1 - sev));
  const sat = 60 + Math.round(22 * sev);
  const lig = 47 - Math.round(12 * sev);
  const hue2 = Math.max(0, hue - 14);
  chip.style.background =
    'linear-gradient(135deg, hsl(' +
    hue +
    ',' +
    sat +
    '%,' +
    (lig + 8) +
    '%), hsl(' +
    hue2 +
    ',' +
    sat +
    '%,' +
    lig +
    '%))';
  chip.style.borderColor = 'rgba(255,255,255,0.24)';
  chip.style.color = sev > 0.5 ? '#f8fafc' : '#0f172a';
}

export function buildCblChipElement(
  steamId64: string,
  data: CblRatingData,
  extraChipClass?: string,
  labelMode: 'full' | 'compact' = 'full',
): HTMLAnchorElement {
  const chip = document.createElement('a');
  chip.className = 'bss-toolkit-cbl-chip' + (extraChipClass ? ' ' + extraChipClass : '');
  chip.href = cblSearchUrl(steamId64);
  chip.target = '_blank';
  chip.rel = 'noopener noreferrer';

  const detailParts = cblDetailParts(data);
  const detailStr = detailParts.join(' · ');

  if (labelMode === 'compact') {
    let quotedVal: string;
    if (data.reputationPoints != null && !Number.isNaN(Number(data.reputationPoints))) {
      quotedVal = String(data.reputationPoints);
    } else if (data.riskRating != null && String(data.riskRating).trim() !== '') {
      quotedVal = String(data.riskRating).trim();
    } else {
      quotedVal = '—';
    }
    chip.textContent = "CBL: '" + quotedVal + "'";
    const tip = detailStr ? 'CBL · ' + detailStr : 'Community Ban List';
    chip.title = data.displayName ? data.displayName + ' — ' + tip : tip;
    applyCblChipSeverityStyles(chip, data);
    return chip;
  }

  chip.textContent = 'CBL · ' + detailStr;
  chip.title = data.displayName ? data.displayName + ' — Community Ban List' : 'Community Ban List';
  applyCblChipSeverityStyles(chip, data);
  return chip;
}

export const CblRatingChip = {
  insertAfterName(
    anchor: HTMLElement,
    nameCol: HTMLElement,
    steamId64: string,
    data: CblPayload,
    chipClass: string,
    labelMode: 'full' | 'compact',
  ): void {
    if (!data || data.kind === 'error' || data.kind === 'notFound') return;
    if (!cblHasReputationOrRiskRating(data)) return;
    if (!nameCol.isConnected || !anchor.isConnected) return;
    if (nameCol.querySelector('[' + CBL_FOR_ATTR + '="' + steamId64 + '"]')) return;

    nameCol.classList.add('bss-toolkit-name-row');

    const wrap = document.createElement('span');
    wrap.className = 'bss-toolkit-cbl-wrap';
    wrap.setAttribute(CBL_FOR_ATTR, steamId64);

    const chip = buildCblChipElement(steamId64, data, chipClass, labelMode);
    wrap.appendChild(chip);
    anchor.insertAdjacentElement('afterend', wrap);
  },

  mount(nameCol: HTMLElement, steamId64: string, svc: CblReputationService): void {
    const anchor = nameCol.querySelector<HTMLElement>('a[href*="/rcon/players/"]');
    if (!anchor) return;
    if (nameCol.querySelector('[' + CBL_FOR_ATTR + '="' + steamId64 + '"]')) return;

    const onData: (err: unknown, data: CblPayload | null) => void = (err, data) => {
      if (err || !data) return;
      CblRatingChip.insertAfterName(
        anchor,
        nameCol,
        steamId64,
        data,
        'bss-toolkit-cbl-chip--table',
        'compact',
      );
    };

    const cached = svc.getCached(steamId64);
    if (cached !== null) {
      onData(null, cached);
      return;
    }
    svc.enqueue(steamId64, onData);
  },

  /** Same chip as the player list, placed in the profile title row (h1). */
  mountInHeader(h1El: HTMLElement, steamId64: string, svc: CblReputationService): void {
    const path = location.pathname;
    if (
      h1El.querySelector(
        '[' + PROFILE_HEADER_CBL_ATTR + '][' + PROFILE_PATH_ATTR + '="' + path + '"]',
      )
    ) {
      return;
    }

    const onData: (err: unknown, data: CblPayload | null) => void = (err, data) => {
      if (h1El.getAttribute(CBL_PENDING_ATTR) === path) h1El.removeAttribute(CBL_PENDING_ATTR);
      if (err || !data || data.kind === 'error' || data.kind === 'notFound') return;
      if (!cblHasReputationOrRiskRating(data)) return;
      if (!h1El.isConnected || location.pathname !== path) return;

      const dup = h1El.querySelector('[' + PROFILE_HEADER_CBL_ATTR + ']');
      if (dup && dup.getAttribute(PROFILE_PATH_ATTR) === path) return;

      const olds = h1El.querySelectorAll('[' + PROFILE_HEADER_CBL_ATTR + ']');
      for (let o = 0; o < olds.length; o++) olds[o].remove();

      h1El.classList.add('bss-toolkit-profile-h1-with-chip');

      const wrap = document.createElement('span');
      wrap.className = 'bss-toolkit-cbl-wrap bss-toolkit-cbl-wrap--profile-header';
      wrap.setAttribute(PROFILE_HEADER_CBL_ATTR, '1');
      wrap.setAttribute(PROFILE_PATH_ATTR, path);

      const chip = buildCblChipElement(
        steamId64,
        data,
        'bss-toolkit-cbl-chip--profile-header',
        'full',
      );
      wrap.appendChild(chip);
      h1El.appendChild(wrap);
    };

    const cached = svc.getCached(steamId64);
    if (cached !== null) {
      onData(null, cached);
      return;
    }

    h1El.setAttribute(CBL_PENDING_ATTR, path);
    svc.enqueue(steamId64, onData);
  },
};
