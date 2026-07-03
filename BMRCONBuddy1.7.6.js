// ==UserScript==
// @name         BM RCON Buddy
// @namespace    https://communitybanlist.com
// @version      1.7.6
// @description  Squad RCON toolkit: CBL chips, feed colors, admin-tag name colors, note menu, BM flag rows.
// @author       Ethik
// @license      MIT
// @match        https://www.battlemetrics.com/rcon/servers/34935347*
// @match        https://www.battlemetrics.com/rcon/players/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @connect      communitybanlist.com
// @connect      www.battlemetrics.com
// @connect      api.steampowered.com
// ==/UserScript==

/*
 * ============================================================================
 * BM RCON Buddy
 * ============================================================================
 *
 * Tampermonkey userscript for Squad server admins on Battlemetrics RCON.
 * Scoped narrowly to one server dashboard plus all player profile pages.
 *
 * PAGES
 *   • /rcon/servers/34935347*  — connected players + live RCON feed
 *   • /rcon/players/*          — player profile (Overview, Activity, etc.)
 *
 * FEATURES (by module — search for section headers below)
 *   1. ConnectedPlayersPanel   CBL chips, BM flag row colors, player filter
 *   2. RconLiveFeed              Feed phrase colors, highlight rules, feed filter
 *   3. FeedColorEnhancer         Shared feed styling (server feed + profile activity log)
 *   4. AdminTagNameStyler        Cyan name for players with BM admin badge/tag only
 *   5. ProfilePageRunner         Single observer for profile-page enhancements
 *   6. PlayerProfileOverviewUi   Copy Player Info + Note Menu (Warn/Kick templates)
 *
 * ARCHITECTURE
 *   • IIFE, no build step; ES5-style for Tampermonkey compatibility
 *   • MutationObserver + debounced/interval reconcile (virtual-scroll safe)
 *   • Idempotent DOM markers (data-bss-processed, data-bss-feed-processed)
 *   • Settings persist via GM_getValue / GM_setValue (prefix: bssToolkit.v1.)
 *   • SPA routing: history.pushState/replaceState watcher + teardown on navigate
 *
 * TABLE OF CONTENTS (section headers in source)
 *   Storage helpers
 *   CSS
 *   Parsing (player rows, feed lines)
 *   Feed colors (phrase → inline color)
 *   Admin tag name colors
 *   Steam ban lookup (optional VAC row tint)
 *   Player flag row styling
 *   Highlight rules
 *   CBL GraphQL + reputation service
 *   CBL chip UI
 *   Connected players panel
 *   RCON live feed
 *   Player profile scheduler + CBL header + Overview actions
 *   Toolkit app (bootstrap + routing)
 * ============================================================================
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Types (JSDoc) — used by reviewers and editors with TypeScript checking
  // ---------------------------------------------------------------------------

  /** @typedef {{ steamId64: string, displayName: string, roleText: string, teamText: string, squadText: string, badgeTitles: string[], hasPlayerNote: boolean, rowEl: HTMLElement }} ParsedPlayerRow */
  /** @typedef {{ type: string, className?: string, borderColor?: string }} HighlightAction */
  /** @typedef {{ id: string, enabled: boolean, feedLineMatches?: string, textMatches?: string, steamIdInList?: string[], teamEquals?: string, roleMatches?: string, badgeTitleContains?: string, actions: HighlightAction[] }} HighlightRule */

  // ---------------------------------------------------------------------------
  // Constants — keep MATCHED_SERVER_PATH_RE in sync with @match above
  // ---------------------------------------------------------------------------

  var STORAGE_PREFIX = 'bssToolkit.v1.';
  var PROCESSED_ATTR = 'data-bss-processed';           // player row handled by toolkit
  var FEED_PROCESSED_ATTR = 'data-bss-feed-processed'; // feed line handled by toolkit

  /** Server URL from @match; used for SPA route checks. */
  var MATCHED_SERVER_PATH_RE = /\/rcon\/servers\/34935347/;

  var STEAM_ID64_RE = /^7656119\d{10}$/;
  var EOS_ID_RE = /^[0-9a-f]{32}$/i;

  /** Live refs for teardown / rescan when Battlemetrics navigates without full reload. */
  var bmToolkitServer = {
    players: null, // ConnectedPlayersPanel instance
    feed: null,    // RconLiveFeed instance
    cbl: null      // CblReputationService instance (server page)
  };

  /** Lazy CBL service for standalone player profile route (no server dashboard). */
  var profilePageCblService = null;

  var CBL_GRAPHQL_URL = 'https://communitybanlist.com/graphql';
  var CBL_SEARCH_URL = function (steamId64) {
    return 'https://communitybanlist.com/search/' + encodeURIComponent(steamId64);
  };

  /** Built-in feed highlight rules (warn / trigger / kick left-border tints). */
  var DEFAULT_RULES = /** @type {HighlightRule[]} */ ([
    {
      id: 'feed-remote-warn',
      enabled: true,
      feedLineMatches: 'Remote admin has warned',
      actions: [{ type: 'setRowClass', className: 'bss-toolkit-feed-warn' }]
    },
    {
      id: 'feed-trigger',
      enabled: true,
      feedLineMatches: 'by Trigger',
      actions: [{ type: 'setRowClass', className: 'bss-toolkit-feed-trigger' }]
    },
    {
      id: 'feed-kick',
      enabled: true,
      feedLineMatches: 'was kicked',
      actions: [{ type: 'setRowClass', className: 'bss-toolkit-feed-kick' }]
    }
  ]);

  // --- Storage helpers ------------------------------------------------------

  function storageGet(key, defaultValue) {
    var v = GM_getValue(STORAGE_PREFIX + key, undefined);
    return v === undefined ? defaultValue : v;
  }

  function storageSet(key, value) {
    GM_setValue(STORAGE_PREFIX + key, value);
  }

  /**
   * @param {string} text
   * @param {(ok: boolean) => void} [cb]
   */
  function copyTextToClipboard(text, cb) {
    function done(ok) {
      if (cb) cb(!!ok);
    }
    if (typeof GM_setClipboard === 'function') {
      try {
        GM_setClipboard(text, 'text');
        done(true);
        return;
      } catch (e) {}
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(function () {
          done(true);
        })
        .catch(function () {
          legacyCopyTextToClipboard(text, done);
        });
      return;
    }
    legacyCopyTextToClipboard(text, done);
  }

  /**
   * @param {string} text
   * @param {(ok: boolean) => void} cb
   */
  function legacyCopyTextToClipboard(text, cb) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {}
    ta.remove();
    cb(ok);
  }

  function stripBssToolkitClassesFromElement(el) {
    if (!el || !el.classList) return;
    var cl = el.classList;
    for (var i = cl.length - 1; i >= 0; i--) {
      var n = cl[i];
      if (n.indexOf('bss-toolkit-') === 0) cl.remove(n);
    }
  }

  // --- CSS ------------------------------------------------------------------
  // Injected once at init. Class prefix: bss-toolkit-
  // Prefer stable data-* hooks in JS; emotion classes (css-*) are fallbacks only.

  var CssInjector = {
    injected: false,

    /** @returns {string[]} */
    buildRules: function () {
      return [
        // -- Shared buttons --
        '.bss-toolkit-btn {',
        '  background: #243044;',
        '  color: #e8edf5;',
        '  border: 1px solid #3a4a62;',
        '  border-radius: 6px;',
        '  padding: 4px 8px;',
        '  cursor: pointer;',
        '  font-size: 12px;',
        '}',
        '.bss-toolkit-btn:hover { background: #2c3a50; }',

        // -- Player list name column (block flow: name+chip on line 1, details line 2) --
        '.bss-toolkit-name-row { display: block; }',
        '.bss-toolkit-name-row > a { display: inline; vertical-align: baseline; }',

        // -- CBL reputation chip --
        '.bss-toolkit-cbl-wrap {',
        '  display: inline-flex;',
        '  align-items: center;',
        '  gap: 4px;',
        '  margin: 0 0 0 8px;',
        '  vertical-align: middle;',
        '  max-width: 100%;',
        '}',
        '.bss-toolkit-cbl-chip {',
        '  display: inline-flex;',
        '  align-items: center;',
        '  gap: 4px;',
        '  border-radius: 999px;',
        '  padding: 3px 10px;',
        '  font-size: 11px;',
        '  font-weight: 700;',
        '  border: 1px solid rgba(255,255,255,.22);',
        '  text-decoration: none;',
        '  cursor: pointer;',
        '  line-height: 1.25;',
        '  box-shadow: 0 1px 2px rgba(0,0,0,.35);',
        '}',
        '.bss-toolkit-cbl-chip:hover { filter: brightness(1.08); }',
        '.bss-toolkit-cbl-chip--muted { opacity: .85; font-weight: 500; }',
        '.bss-toolkit-cbl-chip--err {',
        '  border-color: #6b3a3a;',
        '  background: #2a1818;',
        '  color: #ffb4b4;',
        '}',

        // -- Filters (dim/hide non-matching rows or feed lines) --
        '.bss-toolkit-player-filtered { display: none !important; }',
        '.bss-toolkit-feed-filtered { opacity: .22; }',

        // -- Feed highlight rules (left border + faint background) --
        '.bss-toolkit-feed-warn {',
        '  box-shadow: inset 3px 0 0 #e6b422 !important;',
        '  background: rgba(230,180,34,.08) !important;',
        '}',
        '.bss-toolkit-feed-trigger {',
        '  box-shadow: inset 3px 0 0 #c96bdd !important;',
        '  background: rgba(201,107,221,.07) !important;',
        '}',
        '.bss-toolkit-feed-kick {',
        '  box-shadow: inset 3px 0 0 #e05252 !important;',
        '  background: rgba(224,82,82,.08) !important;',
        '}',

        // -- Admin tag: cyan player name (BM admin badge present) --
        '.bss-toolkit-admin-tag-name { color: #00fff7 !important; }',

        // -- Player row flag tints (priority: admin → sus → steam ban) --
        '.bss-toolkit-player-accent { border-left: 3px solid transparent; }',
        '.bss-toolkit-bmflag-admin {',
        '  border-left: 3px solid #e91eac !important;',
        '  background: rgba(233,30,172,.12) !important;',
        '}',
        '.bss-toolkit-bmflag-sus {',
        '  border-left: 3px solid #e67e22 !important;',
        '  background: rgba(230,126,34,.12) !important;',
        '}',
        '.bss-toolkit-bmflag-steam-ban {',
        '  border-left: 3px solid #dc2626 !important;',
        '  background: rgba(220,38,38,.14) !important;',
        '}',

        // -- Player list: slightly smaller CBL chip --
        'div[data-session] .bss-toolkit-cbl-chip--table {',
        '  font-size: 9.9px;',
        '  padding: 2.7px 9px;',
        '  gap: 3.6px;',
        '}',
        'div[data-session] .bss-toolkit-cbl-wrap { margin-left: 7.2px; }',

        // -- Profile header CBL chip beside h1 --
        '.bss-toolkit-profile-h1-with-chip {',
        '  display: flex;',
        '  align-items: center;',
        '  flex-wrap: wrap;',
        '  column-gap: 10px;',
        '  row-gap: 6px;',
        '}',
        '.bss-toolkit-cbl-wrap--profile-header {',
        '  margin: 0 !important;',
        '  vertical-align: middle;',
        '}',

        // -- Profile Overview: Copy + Note Menu --
        '.bss-toolkit-profile-actions {',
        '  display: flex;',
        '  flex-direction: column;',
        '  gap: 8px;',
        '  margin: 10px 0 16px 0;',
        '  max-width: 260px;',
        '  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;',
        '}',
        '.bss-toolkit-profile-actions .bss-toolkit-btn--block {',
        '  display: block;',
        '  width: 100%;',
        '  padding: 9px 12px;',
        '  font-size: 13px;',
        '  font-weight: 600;',
        '  text-align: center;',
        '  box-sizing: border-box;',
        '}',
        '.bss-toolkit-profile-actions .bss-toolkit-btn--primary {',
        '  background: #1e3a5f;',
        '  border-color: #3b82f6;',
        '  color: #e8edf5;',
        '}',
        '.bss-toolkit-profile-actions .bss-toolkit-btn--primary:hover { background: #234878; }',
        '.bss-toolkit-profile-actions .bss-toolkit-btn--copied {',
        '  border-color: #3d8f5c !important;',
        '  background: #1a3d2e !important;',
        '}',
        '.bss-toolkit-note-menu { position: relative; width: 100%; }',
        '.bss-toolkit-note-dropdown {',
        '  display: none;',
        '  background: #0e131a;',
        '  border: 1px solid #2a3340;',
        '  border-radius: 6px;',
        '  margin-top: 4px;',
        '  overflow: hidden;',
        '}',
        '.bss-toolkit-note-dropdown.is-open { display: block; }',
        '.bss-toolkit-note-dropdown button {',
        '  display: block;',
        '  width: 100%;',
        '  text-align: left;',
        '  padding: 8px 10px;',
        '  background: transparent;',
        '  border: none;',
        '  border-bottom: 1px solid #1f2937;',
        '  color: #e8edf5;',
        '  cursor: pointer;',
        '  font-size: 12px;',
        '}',
        '.bss-toolkit-note-dropdown button:last-child { border-bottom: none; }',
        '.bss-toolkit-note-dropdown button:hover { background: #243044; }',
        '.bss-toolkit-note-submenu { display: none; margin-top: 4px; }',
        '.bss-toolkit-note-submenu.is-open { display: block; }',

        // -- Desktop toolkit parity: z-index + nav width (emotion classes may change) --
        '.css-ym7lu8 { z-index: 2; }',
        '.css-z1s6qn { z-index: 3; }',
        '.css-1jtoyp { z-index: 3; }',
        '#RCONLayout > nav > ul > li.css-1nxi32t > a {',
        '  width: 100vw;',
        '  max-width: 100%;',
        '}'
      ];
    },

    inject: function () {
      if (this.injected) return;
      this.injected = true;
      var style = document.createElement('style');
      style.setAttribute('data-bss-toolkit', '1');
      style.textContent = this.buildRules().join('\n');
      (document.head || document.documentElement).appendChild(style);
    }
  };

  // --- Parsing --------------------------------------------------------------
  // DOM helpers: normalize text, read player rows, detect feed line structure.
  // Player row hook: div[data-session]. Feed line hook: parent of <time> + message <div>.

  function normalizeWs(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Read SteamID64 from the Platform ID column.
   * @param {HTMLElement} rowEl
   * @returns {string|null}
   */
  function extractSteamId64FromRow(rowEl) {
    var cell = rowEl.querySelector('[data-title="Platform ID"]');
    if (!cell) return null;
    var span = cell.querySelector('span[title]') || cell.querySelector('span');
    var raw = (span && span.getAttribute('title')) || (span && span.textContent) || cell.textContent || '';
    raw = normalizeWs(raw);
    return STEAM_ID64_RE.test(raw) ? raw : null;
  }

  /**
   * Read BM flag titles from a player's name area.
   *
   * BM moved flag titles onto nested <svg title="..."> (and their wrapping
   * span[title]); they are no longer plain span[title]. We must NOT collect:
   *   - the name <a title="..."> (the player's display name), and
   *   - the "Play Time" <time title="..."> tooltip (a date string),
   * both of which live inside div.name and would pollute search/highlight rules.
   *
   * @param {ParentNode|null} nameArea
   * @returns {string[]}
   */
  function collectBadgeTitlesFromNameArea(nameArea) {
    var badgeTitles = [];
    if (!nameArea || !nameArea.querySelectorAll) return badgeTitles;
    var badges = nameArea.querySelectorAll('svg[title], span[title]');
    for (var b = 0; b < badges.length; b++) {
      var el = badges[b];
      if (el.closest && el.closest('a[href*="/rcon/players/"]')) continue;
      var title = el.getAttribute('title');
      if (title) badgeTitles.push(title);
    }
    return badgeTitles;
  }

  /**
   * @param {HTMLElement} rowEl
   * @returns {ParsedPlayerRow|null}
   */
  function parsePlayerRow(rowEl) {
    if (!rowEl || !rowEl.getAttribute('data-session')) return null;
    var steamId64 = extractSteamId64FromRow(rowEl);
    if (!steamId64) return null;

    var nameArea = rowEl.querySelector('div.name');
    var nameAnchor = nameArea
      ? nameArea.querySelector('a[href*="/rcon/players/"]')
      : rowEl.querySelector('div.name a[href*="/rcon/players/"]');
    var displayName = nameAnchor ? normalizeWs(nameAnchor.textContent || '') : '';

    var roleText = '';
    var details = rowEl.querySelectorAll('div.player-detail .text-muted');
    for (var i = 0; i < details.length; i++) {
      var t = normalizeWs(details[i].textContent || '');
      if (t.indexOf('Role:') === 0) {
        roleText = t;
        break;
      }
    }

    var teamEl = rowEl.querySelector('[data-title="Team"]');
    var squadEl = rowEl.querySelector('[data-title="Squad"]');
    var teamText = teamEl ? normalizeWs(teamEl.textContent || '') : '';
    var squadText = squadEl ? normalizeWs(squadEl.textContent || '') : '';

    var badgeTitles = collectBadgeTitlesFromNameArea(nameArea);

    var hasPlayerNote = !!rowEl.querySelector('span.css-sq8q19') || !!rowEl.querySelector('.glyphicon-comment');

    return {
      steamId64: steamId64,
      displayName: displayName,
      roleText: roleText,
      teamText: teamText,
      squadText: squadText,
      badgeTitles: badgeTitles,
      hasPlayerNote: hasPlayerNote,
      rowEl: rowEl
    };
  }

  /**
   * Build a single searchable string for player filter matching.
   * @param {ParsedPlayerRow} p
   */
  function playerRowSearchBlob(p) {
    return [
      p.displayName,
      p.steamId64,
      p.roleText,
      p.teamText,
      p.squadText,
      p.badgeTitles.join(' ')
    ]
      .join(' ')
      .toLowerCase();
  }

  /**
   * Feed lines: legacy <time><div> siblings, or BM layout with <span><time></span><div>.
   * @param {HTMLElement} lineEl
   * @returns {HTMLElement|null}
   */
  function getFeedMessageElement(lineEl) {
    if (!lineEl) return null;
    var kids = lineEl.children;
    var i;
    for (i = 0; i < kids.length; i++) {
      if (kids[i].tagName === 'DIV' && !kids[i].querySelector('time')) return kids[i];
    }
    for (i = 0; i < kids.length; i++) {
      if (kids[i].tagName === 'TIME') {
        var next = kids[i].nextElementSibling;
        if (next && next.tagName === 'DIV') return next;
      }
    }
    return null;
  }

  /** Feed line shape: contains <time> plus a message <div> (server feed + profile activity). */
  function isFeedLineStructure(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (!el.querySelector('time')) return false;
    return !!getFeedMessageElement(el);
  }

  /**
   * Walk up from a <time> wrapper to the activity row container.
   * @param {HTMLElement|null} fromEl
   * @returns {HTMLElement|null}
   */
  function resolveFeedLineContainer(fromEl) {
    if (!fromEl || !(fromEl instanceof HTMLElement)) return null;
    var cur = fromEl;
    var depth = 0;
    while (cur && depth < 6) {
      if (isFeedLineStructure(cur)) return cur;
      cur = cur.parentElement;
      depth++;
    }
    return null;
  }

  /** Unprocessed feed line on server dashboard (used for first-pass marking). */
  function isRconFeedLine(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.getAttribute(FEED_PROCESSED_ATTR)) return false;
    return isFeedLineStructure(el);
  }

  function getFeedLineText(el) {
    var msg = getFeedMessageElement(el);
    return msg ? normalizeWs(msg.textContent || '') : '';
  }

  // --- Feed colors (phrase → inline text color) -----------------------------
  // Desktop toolkit parity. Colors entire feed message <div> when phrase matches.
  // Does NOT color individual player names (see AdminTagNameStyler for that).

  var FEED_COLORS = {
    cModAction: '#ff3333',    // warn / kick / ban
    cAdminAction: '#37ff00',  // map change, squad disband, flags, etc.
    cTeamKilled: '#ffcc00',
    cTeamBluefor: '#e7a600',
    cTeamPac: '#34804d',
    cTeamOpfor: '#d95627',
    cTeamIndep: '#eaff00',
    cTracked: '#919191'       // auto-kick / spam triggers
  };

  var FEED_PHRASE_SETS = {
    teamKilled: ['team killed'],

    // Mod actions (red) — player discipline
    actionList: [
      'was warned',
      'was kicked',
      'was banned',
      'edited BattleMetrics Ban',
      'added BattleMetrics Ban',
      'deleted BattleMetrics Ban'
    ],

    // Admin / server actions (green)
    adminTerms: [
      'admin',
      'Admin',
      'ADMIN',
      'aDMIN',
      'to the other team.',
      ') was disbanded b',
      'requested a list of squads.',
      'set the next map to',
      'changed the map to',
      'requested the next map.',
      ') forced',
      'AdminRenameSquad',
      '(Global)',
      'executed Player Action Action',
      'requested the current map.',
      'restarted the match.',
      'Squad disband - SL',
      'was removed from their squad by Trigger.',
      'requested layer list.',
      'was removed from their squad by',
      'added flag',
      'removed flag'
    ],

    // Faction team names in feed text
    teamBluefor: [
      'Australian Defence Force',
      'British Armed Forces',
      'Canadian Armed Forces',
      'United States Army',
      'United States Marine Corps'
    ],
    teamPac: ["People's Liberation Army", 'PLA Amphibious Ground Forces', 'PLA Navy Marine Corps'],
    teamOpfor: ['Russian Airborne Forces', 'Russian Ground Forces'],
    teamIndep: [
      'Western Private Military Contractors',
      'Middle Eastern Alliance',
      'Turkish Land Forces',
      'Middle Eastern Insurgents',
      'Irregular Militia Forces'
    ],

    // Known auto-kick / auto-warn spam (gray)
    trackedTriggers: [
      'Welcome to gMg!',
      'We offer FREE WHITELIST',
      'Auto-Warn | Squads containing MBTs',
      'Auto-Warn | Vehicles requiring crewman',
      'Seeding progress degrades',
      'Auto-Warn | Piloting a Heli?',
      'Auto-Warn | New pilots are NOT permitted',
      'Auto Kick - Username must contain',
      'Welcome to gMg! Be sure to join',
      'You are earning FREE',
      'There are over 88',
      'Auto Kick - Your Steam Community',
      'Streaming? Consider a minimum',
      'Join a squad, you are unassigned and will be kicked',
      'No more facts for you. Touch grass.',
      'Seeding Reward:',
      'Auto-Kick | Steam Account must be at least 14 days'
    ]
  };

  var FeedTextColorEngine = {
    // Apply phrase colors to a single feed message element.
    /**
     * @param {HTMLElement} msgEl
     * @param {string} text
     */
    applyToMessage: function (msgEl, text) {
      if (!msgEl || !text) return;

      if (this.matchPhrases(text, FEED_PHRASE_SETS.adminTerms)) {
        msgEl.style.color = FEED_COLORS.cAdminAction;
      }
      if (this.matchPhrases(text, FEED_PHRASE_SETS.actionList)) {
        msgEl.style.color = FEED_COLORS.cModAction;
      }
      if (this.matchPhrases(text, FEED_PHRASE_SETS.teamBluefor)) {
        msgEl.style.color = FEED_COLORS.cTeamBluefor;
      } else if (this.matchPhrases(text, FEED_PHRASE_SETS.teamPac)) {
        msgEl.style.color = FEED_COLORS.cTeamPac;
      } else if (this.matchPhrases(text, FEED_PHRASE_SETS.teamOpfor)) {
        msgEl.style.color = FEED_COLORS.cTeamOpfor;
      } else if (this.matchPhrases(text, FEED_PHRASE_SETS.teamIndep)) {
        msgEl.style.color = FEED_COLORS.cTeamIndep;
      }
      if (this.matchPhrases(text, FEED_PHRASE_SETS.teamKilled)) {
        msgEl.style.color = FEED_COLORS.cTeamKilled;
      }
      if (this.matchPhrases(text, FEED_PHRASE_SETS.trackedTriggers)) {
        msgEl.style.color = FEED_COLORS.cTracked;
      }
    },

    /**
     * @param {string} text
     * @param {string[]} phrases
     */
    matchPhrases: function (text, phrases) {
      for (var i = 0; i < phrases.length; i++) {
        if (text.indexOf(phrases[i]) !== -1) return true;
      }
      return false;
    },

    /**
     * @param {HTMLElement} lineEl
     */
    applyToLine: function (lineEl) {
      var msg = getFeedMessageElement(lineEl);
      if (!msg) return;
      var text = normalizeWs(msg.textContent || '');
      this.applyToMessage(msg, text);
    }
  };

  var FeedTimestampEnhancer = {
    // Add local-timezone tooltip to <time datetime="..."> elements.
    applyToTime: function (timeEl) {
      if (!timeEl || timeEl.tagName !== 'TIME') return;
      if (timeEl.getAttribute('data-bss-ts-title')) return;
      var raw = timeEl.getAttribute('datetime');
      if (!raw) return;
      var d = new Date(raw);
      if (Number.isNaN(d.getTime())) return;
      timeEl.setAttribute('title', d.toLocaleString(undefined, { timeZoneName: 'short' }));
      timeEl.setAttribute('data-bss-ts-title', '1');
    },

    applyAll: function () {
      var times = document.querySelectorAll('time[datetime]');
      for (var i = 0; i < times.length; i++) this.applyToTime(times[i]);
    }
  };

  var ServerModalStyler = {
    // Warn/Kick/Layer dialog and squad command menu colors (emotion-class selectors).
    modalTitleRules: [
      { phrase: 'Change Layer', styles: { color: 'red', fontWeight: 'bold', textAlign: 'center', fontSize: '100pt' } },
      { phrase: 'Set Next Layer', styles: { color: 'lime', fontWeight: 'bold', textAlign: 'center', fontSize: '50pt' } },
      { phrase: 'Kick', styles: { color: 'orange', fontWeight: 'bold', textAlign: 'center', fontSize: '48pt' } },
      { phrase: 'Warn', styles: { color: 'lime', fontWeight: 'bold', textAlign: 'center', fontSize: '24pt' } }
    ],
    menuRulesA: [
      { phrase: 'Warn', styles: { color: 'lime' } },
      { phrase: 'Squad List', styles: { color: 'gold' } },
      { phrase: 'Kick', styles: { color: 'orange' } },
      { phrase: 'Ban', styles: { color: 'red' } }
    ],
    menuRulesB: [
      { phrase: 'Ban', styles: { color: 'red' } },
      { phrase: 'Next Layer', styles: { color: 'lime', fontSize: '16pt' } },
      { phrase: 'Change Layer', styles: { color: 'red', fontWeight: 'bold', fontSize: '8pt' } },
      { phrase: 'Squad List', styles: { color: 'gold', fontSize: '16pt' } }
    ],

    applyRules: function (nodes, rules) {
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var txt = el.textContent || '';
        for (var r = 0; r < rules.length; r++) {
          if (txt.indexOf(rules[r].phrase) !== -1) {
            Object.assign(el.style, rules[r].styles);
          }
        }
      }
    },

    apply: function () {
      this.applyRules(document.querySelectorAll('.modal-title'), this.modalTitleRules);
      this.applyRules(document.querySelectorAll('.css-f5o5h6 a, .css-f5o5h6 button'), this.menuRulesA);
      this.applyRules(document.querySelectorAll('.css-1ixz43s a, .css-1ixz43s button'), this.menuRulesA);
      this.applyRules(document.querySelectorAll('.css-yun63y a, .css-yun63y button'), this.menuRulesB);
    }
  };

  /**
   * Shared feed styling for server live feed and profile activity log.
   * Hybrid update: MutationObserver for new lines + interval reconcile for virtual scroll.
   */
  var FeedColorEnhancer = {
    reconcileDocument: function (options) {
      options = options || {};
      var root = options.scopeRoot || document;

      var times = root.querySelectorAll('time');
      for (var i = 0; i < times.length; i++) {
        // BM may wrap <time> in a <span>, so resolve up to the real feed row.
        var lineEl = resolveFeedLineContainer(times[i].parentElement);
        if (lineEl) {
          FeedTextColorEngine.applyToLine(lineEl);
          var text = getFeedLineText(lineEl);
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
    }
  };

  function getColorRowsByBmFlags() {
    return storageGet('colorRowsByBmFlags', true) !== false;
  }

  /** Row classes for Battlemetrics-derived row tint (cleared before re-apply). */
  var BM_FLAG_ROW_CLASSES = ['bss-toolkit-bmflag-admin', 'bss-toolkit-bmflag-sus', 'bss-toolkit-bmflag-steam-ban'];

  // --- Admin tag name colors ------------------------------------------------
  // Cyan (#00fff7) player name ONLY when BM admin badge/tag is present.
  // Badge = svg[title] / span[title] flag in div.name whose title contains
  // "admin" (excludes "Regular Player").
  // Applied to: connected player list name link, profile h1 name link.
  // NOT applied to feed/activity log (no badge context there).

  /**
   * True when badge title looks like a BM admin flag (e.g. "NL Squad Admin").
   * @param {string} title
   */
  function isAdminBadgeTitle(title) {
    var t = (title || '').toLowerCase();
    if (t.indexOf('admin') === -1) return false;
    if (t.indexOf('regular player') !== -1) return false;
    return true;
  }

  var ADMIN_TAG_NAME_COLOR = '#00fff7';
  var ADMIN_TAG_NAME_CLASS = 'bss-toolkit-admin-tag-name';
  var ADMIN_TAG_NAME_MARK_ATTR = 'data-bss-admin-tag-name';

  /**
   * @param {string[]} badgeTitles
   */
  function badgeTitlesIncludeAdminTag(badgeTitles) {
    for (var i = 0; i < badgeTitles.length; i++) {
      if (isAdminBadgeTitle(badgeTitles[i])) return true;
    }
    return false;
  }

  /**
   * Detect a BM admin flag anywhere within a scope (e.g. a profile page).
   * Flags now carry their title on <svg> (wrapped in span[title]); the prior
   * span[title]-only query missed them, so we check both flag shapes plus any
   * div.name badge groups.
   * @param {ParentNode} scope
   */
  function scopeHasAdminTag(scope) {
    if (!scope || !scope.querySelectorAll) return false;
    var flagNodes = scope.querySelectorAll('[data-testid^="flag-"][title], svg[title], span[title]');
    for (var i = 0; i < flagNodes.length; i++) {
      if (isAdminBadgeTitle(flagNodes[i].getAttribute('title'))) return true;
    }
    var nameAreas = scope.querySelectorAll('div.name');
    for (var n = 0; n < nameAreas.length; n++) {
      if (badgeTitlesIncludeAdminTag(collectBadgeTitlesFromNameArea(nameAreas[n]))) return true;
    }
    return false;
  }

  /**
   * @param {HTMLElement} el
   * @param {boolean} hasAdminTag
   */
  function setAdminTagNameStyle(el, hasAdminTag) {
    if (!el) return;
    if (hasAdminTag) {
      el.classList.add(ADMIN_TAG_NAME_CLASS);
      el.style.color = ADMIN_TAG_NAME_COLOR;
      el.setAttribute(ADMIN_TAG_NAME_MARK_ATTR, '1');
      return;
    }
    el.classList.remove(ADMIN_TAG_NAME_CLASS);
    if (el.getAttribute(ADMIN_TAG_NAME_MARK_ATTR) === '1') {
      el.style.removeProperty('color');
      el.removeAttribute(ADMIN_TAG_NAME_MARK_ATTR);
    }
  }

  var AdminTagNameStyler = {
    /** Color or clear name link on a connected player row. */
    applyToPlayerRow: function (parsed) {
      var nameAnchor = parsed.rowEl.querySelector('div.name a[href*="/rcon/players/"]');
      if (!nameAnchor) return;
      setAdminTagNameStyle(nameAnchor, badgeTitlesIncludeAdminTag(parsed.badgeTitles || []));
    },

    /** Color or clear profile page h1 name link when admin tag is on the profile. */
    applyToProfileHeader: function () {
      var h1 =
        document.querySelector('h1.css-8uhtka') ||
        document.querySelector('main h1') ||
        document.querySelector('article h1') ||
        document.querySelector('h1');
      if (!h1) return;

      var nameAnchor = h1.querySelector('a[href*="/rcon/players/"]');
      if (!nameAnchor) return;

      var badgeScope = document.querySelector('main') || document.querySelector('#RCONPlayerPage') || document;
      setAdminTagNameStyle(nameAnchor, scopeHasAdminTag(badgeScope));
    },

    /** Re-scan player rows + profile header (optional scoped root). */
    reconcileTaggedPlayers: function (root) {
      root = root || document;
      var rows = root.querySelectorAll('div[data-session]');
      for (var r = 0; r < rows.length; r++) {
        var parsed = parsePlayerRow(rows[r]);
        if (parsed) this.applyToPlayerRow(parsed);
      }
      if (/\/rcon\/players\/\d+/.test(location.pathname)) {
        this.applyToProfileHeader();
      }
    }
  };

  // --- Steam ban lookup (optional) ------------------------------------------
  // Red row tint when Steam Web API key is stored and player has VAC/game ban.
  // Key was previously set via removed settings panel; still read from storage.

  /**
   * @typedef {{ loading: boolean, vacOrGameBan?: boolean }} SteamBanSnapshot
   */

  function SteamBanLookup() {
    this.cache = Object.create(null);
    this.queue = [];
    this.inFlight = Object.create(null);
    this.running = false;
    this.lastFetchAt = 0;
    this.minIntervalMs = 350;
    this.onUpdate = null;
    this.notifyTimer = null;
    this.loadCache();
  }

  SteamBanLookup.prototype.loadCache = function () {
    var raw = storageGet('steamBanCache', null);
    if (raw && typeof raw === 'object') this.cache = raw;
  };

  SteamBanLookup.prototype.persistCache = function () {
    storageSet('steamBanCache', this.cache);
  };

  SteamBanLookup.prototype.apiKey = function () {
    return String(storageGet('steamWebApiKey', '') || '').trim();
  };

  SteamBanLookup.prototype.cacheTtlMs = function () {
    return 24 * 3600000;
  };

  /**
   * @param {string} steamId64
   * @returns {SteamBanSnapshot|null} null = Steam lookup disabled (no API key)
   */
  SteamBanLookup.prototype.getSnapshot = function (steamId64) {
    if (!this.apiKey()) return null;
    var e = this.cache[steamId64];
    if (e && Date.now() - e.fetchedAt <= this.cacheTtlMs()) {
      return { loading: false, vacOrGameBan: !!e.vacOrGameBan };
    }
    this.enqueue(steamId64);
    return { loading: true, vacOrGameBan: false };
  };

  SteamBanLookup.prototype.enqueue = function (steamId64) {
    if (!this.apiKey()) return;
    if (this.inFlight[steamId64]) return;
    if (this.queue.indexOf(steamId64) !== -1) return;
    this.queue.push(steamId64);
    this.pump();
  };

  SteamBanLookup.prototype.scheduleNotify = function () {
    var self = this;
    if (this.notifyTimer) clearTimeout(this.notifyTimer);
    this.notifyTimer = setTimeout(function () {
      self.notifyTimer = null;
      if (typeof self.onUpdate === 'function') self.onUpdate();
    }, 40);
  };

  SteamBanLookup.prototype.pump = function () {
    var self = this;
    if (this.running) return;
    this.running = true;

    function step() {
      if (!self.queue.length) {
        self.running = false;
        return;
      }
      var key = self.apiKey();
      if (!key) {
        self.queue.length = 0;
        self.running = false;
        return;
      }
      var id = self.queue.shift();

      var wait = self.minIntervalMs - (Date.now() - self.lastFetchAt);
      if (wait < 0) wait = 0;

      setTimeout(function () {
        self.inFlight[id] = true;
        var url =
          'https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=' +
          encodeURIComponent(key) +
          '&steamids=' +
          encodeURIComponent(id);
        GM_xmlhttpRequest({
          method: 'GET',
          url: url,
          onload: function (r) {
            delete self.inFlight[id];
            self.lastFetchAt = Date.now();
            var vacOrGameBan = false;
            try {
              var j = JSON.parse(r.responseText || '{}');
              var p = j.players && j.players[0];
              if (p) {
                vacOrGameBan = !!p.VACBanned || (Number(p.NumberOfGameBans) || 0) > 0;
              }
            } catch (e) {
              vacOrGameBan = false;
            }
            self.cache[id] = { fetchedAt: Date.now(), vacOrGameBan: vacOrGameBan };
            self.persistCache();
            self.scheduleNotify();
            setTimeout(step, 0);
          },
          onerror: function () {
            delete self.inFlight[id];
            self.lastFetchAt = Date.now();
            self.cache[id] = { fetchedAt: Date.now(), vacOrGameBan: false };
            self.persistCache();
            self.scheduleNotify();
            setTimeout(step, 0);
          },
          ontimeout: function () {
            delete self.inFlight[id];
            self.lastFetchAt = Date.now();
            self.cache[id] = { fetchedAt: Date.now(), vacOrGameBan: false };
            self.persistCache();
            self.scheduleNotify();
            setTimeout(step, 0);
          },
          timeout: 20000
        });
      }, wait);
    }

    step();
  };

  /** @type {SteamBanLookup|null} */
  var steamBanLookup = null;

  // --- Player flag row styling ----------------------------------------------
  // Pink admin row, orange sus, red steam ban. First match wins.

  var PlayerFlagStyler = {
    clear: function (rowEl) {
      for (var i = 0; i < BM_FLAG_ROW_CLASSES.length; i++) {
        rowEl.classList.remove(BM_FLAG_ROW_CLASSES[i]);
      }
    },

    /**
     * Priority: Admin (pink) → Sus (orange) → VAC / game ban (red, requires Steam Web API key).
     * @param {ParsedPlayerRow} parsed
     * @param {SteamBanSnapshot|null} steamSnap
     * @returns {boolean}
     */
    apply: function (parsed, steamSnap) {
      var titles = parsed.badgeTitles || [];
      var row = parsed.rowEl;
      var i;

      for (i = 0; i < titles.length; i++) {
        if (isAdminBadgeTitle(titles[i])) {
          row.classList.add('bss-toolkit-bmflag-admin');
          return true;
        }
      }

      for (i = 0; i < titles.length; i++) {
        if (normalizeWs(titles[i]).toLowerCase() === 'sus') {
          row.classList.add('bss-toolkit-bmflag-sus');
          return true;
        }
      }

      if (steamSnap && !steamSnap.loading && steamSnap.vacOrGameBan) {
        row.classList.add('bss-toolkit-bmflag-steam-ban');
        return true;
      }

      return false;
    }
  };

  function resetBuiltinPlayerRowVisuals(rowEl) {
    rowEl.classList.remove('bss-toolkit-player-accent');
    PlayerFlagStyler.clear(rowEl);
  }

  // --- Highlight rules -------------------------------------------------------
  // User-configurable rules (stored) + DEFAULT_RULES for feed line border tints.
  // Player rules match on steam id, team, role, badge title, or free text.

  var HighlightRuleEngine = {
    /**
     * @param {HighlightRule[]} rules
     * @param {ParsedPlayerRow} parsed
     */
    applyPlayer: function (rules, parsed) {
      var row = parsed.rowEl;
      resetBuiltinPlayerRowVisuals(row);
      var steamSnap = steamBanLookup ? steamBanLookup.getSnapshot(parsed.steamId64) : null;
      if (getColorRowsByBmFlags()) {
        if (!PlayerFlagStyler.apply(parsed, steamSnap)) row.classList.add('bss-toolkit-player-accent');
      } else {
        row.classList.add('bss-toolkit-player-accent');
      }

      for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        if (!rule || !rule.enabled) continue;
        if (!this.matchPlayer(rule, parsed)) continue;
        this.applyActions(row, rule.actions);
      }
    },

    /**
     * @param {HighlightRule[]} rules
     * @param {HTMLElement} lineEl
     * @param {string} lineText
     */
    applyFeed: function (rules, lineEl, lineText) {
      for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        if (!rule || !rule.enabled || !rule.feedLineMatches) continue;
        try {
          var re = new RegExp(rule.feedLineMatches, 'i');
          if (!re.test(lineText)) continue;
        } catch (e) {
          if (lineText.toLowerCase().indexOf(String(rule.feedLineMatches).toLowerCase()) === -1) continue;
        }
        this.applyActions(lineEl, rule.actions);
      }
    },

    /**
     * @param {HighlightRule} rule
     * @param {ParsedPlayerRow} parsed
     */
    matchPlayer: function (rule, parsed) {
      if (rule.steamIdInList && rule.steamIdInList.length) {
        if (rule.steamIdInList.indexOf(parsed.steamId64) === -1) return false;
      }
      if (rule.teamEquals !== undefined && rule.teamEquals !== null && String(rule.teamEquals) !== '') {
        if (normalizeWs(parsed.teamText) !== String(rule.teamEquals)) return false;
      }
      if (rule.roleMatches) {
        try {
          var rre = new RegExp(rule.roleMatches, 'i');
          if (!rre.test(parsed.roleText || '')) return false;
        } catch (e) {
          if ((parsed.roleText || '').toLowerCase().indexOf(String(rule.roleMatches).toLowerCase()) === -1) return false;
        }
      }
      if (rule.badgeTitleContains) {
        var ok = false;
        for (var i = 0; i < parsed.badgeTitles.length; i++) {
          if (parsed.badgeTitles[i].toLowerCase().indexOf(rule.badgeTitleContains.toLowerCase()) !== -1) {
            ok = true;
            break;
          }
        }
        if (!ok) return false;
      }
      if (rule.textMatches) {
        try {
          var tre = new RegExp(rule.textMatches, 'i');
          if (!tre.test(playerRowSearchBlob(parsed))) return false;
        } catch (e2) {
          if (playerRowSearchBlob(parsed).indexOf(String(rule.textMatches).toLowerCase()) === -1) return false;
        }
      }
      return !!(rule.steamIdInList && rule.steamIdInList.length) ||
        (rule.teamEquals !== undefined && rule.teamEquals !== null && String(rule.teamEquals) !== '') ||
        !!rule.roleMatches ||
        !!rule.badgeTitleContains ||
        !!rule.textMatches;
    },

    /**
     * @param {HTMLElement} el
     * @param {HighlightAction[]} actions
     */
    applyActions: function (el, actions) {
      if (!actions) return;
      for (var i = 0; i < actions.length; i++) {
        var a = actions[i];
        if (!a) continue;
        if (a.type === 'setRowClass' && a.className) el.classList.add(a.className);
        if (a.type === 'setBorderColor' && a.borderColor) {
          el.style.borderLeft = '3px solid ' + a.borderColor;
        }
        if (a.type === 'hideRow') el.classList.add('bss-toolkit-player-filtered');
      }
    }
  };

  // --- CBL GraphQL (Community Ban List) -------------------------------------
  // Schema from Communitybanlist client. Queue + cache to avoid hammering API.

  var CblGraphqlClient = {
    minimalQuery:
      'query Search($id: String!) {\n' +
      '  steamUser(id: $id) {\n' +
      '    id\n' +
      '    name\n' +
      '    reputationPoints\n' +
      '    riskRating\n' +
      '    reputationRank\n' +
      '  }\n' +
      '}',

    /**
     * @param {string} steamId64
     * @returns {Promise<object>}
     */
    fetchSteamUser: function (steamId64) {
      var body = JSON.stringify({
        query: this.minimalQuery,
        variables: { id: steamId64 }
      });
      return new Promise(function (resolve, reject) {
        GM_xmlhttpRequest({
          method: 'POST',
          url: CBL_GRAPHQL_URL,
          headers: { 'Content-Type': 'application/json' },
          data: body,
          onload: function (r) {
            try {
              resolve(JSON.parse(r.responseText || '{}'));
            } catch (e) {
              reject(e);
            }
          },
          onerror: function (e) {
            reject(e);
          },
          ontimeout: function () {
            reject(new Error('timeout'));
          },
          timeout: 25000
        });
      });
    }
  };

  /**
   * @param {object} gqlJson
   * @returns {{ kind: string, reputationPoints?: number|null, riskRating?: string|null, reputationRank?: number|null, displayName?: string|null }}
   */
  function mapCblResponse(gqlJson) {
    if (!gqlJson) return { kind: 'error' };
    if (gqlJson.errors && gqlJson.errors.length) return { kind: 'error' };
    var su = gqlJson.data && gqlJson.data.steamUser;
    if (!su)
      return {
        kind: 'notFound'
      };
    return {
      kind: 'ok',
      reputationPoints: su.reputationPoints != null ? Number(su.reputationPoints) : null,
      riskRating: su.riskRating != null ? String(su.riskRating) : null,
      reputationRank: su.reputationRank != null ? Number(su.reputationRank) : null,
      displayName: su.name != null ? String(su.name) : null
    };
  }

  function CblReputationService() {
    // Per-steamId64 cache with TTL; deduped queue for concurrent chip mounts.
    this.cache = Object.create(null);
    this.queue = [];
    this.running = false;
    this.ttlMs = Number(storageGet('cblTtlHours', 12)) * 3600000 || 43200000;
    this.minIntervalMs = Number(storageGet('cblMinIntervalMs', 200)) || 200;
    this.lastFetchAt = 0;
    /** @type {Record<string, Function[]>} */
    this.waiters = Object.create(null);
    /** @type {Record<string, boolean>} */
    this.queued = Object.create(null);
    this.persistTimer = null;
  }

  CblReputationService.prototype.loadCache = function () {
    var raw = storageGet('cblCache', null);
    if (!raw || typeof raw !== 'object') return;
    this.cache = raw;
  };

  CblReputationService.prototype.persistCache = function () {
    storageSet('cblCache', this.cache);
  };

  CblReputationService.prototype.persistCacheSoon = function () {
    var self = this;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(function () {
      self.persistTimer = null;
      self.persistCache();
    }, 350);
  };

  CblReputationService.prototype.getCached = function (steamId64) {
    var e = this.cache[steamId64];
    if (!e || !e.fetchedAt) return null;
    if (Date.now() - e.fetchedAt > this.ttlMs) return null;
    return e.payload;
  };

  /** @param {{ kind: string }} payload */
  CblReputationService.prototype.shouldCachePayload = function (payload) {
    return payload && (payload.kind === 'ok' || payload.kind === 'notFound');
  };

  CblReputationService.prototype.setCached = function (steamId64, payload) {
    this.cache[steamId64] = { fetchedAt: Date.now(), payload: payload };
    this.persistCacheSoon();
  };

  CblReputationService.prototype.flushWaiters = function (steamId64, err, data) {
    var list = this.waiters[steamId64];
    delete this.waiters[steamId64];
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      try {
        list[i](err, data);
      } catch (e) {}
    }
  };

  CblReputationService.prototype.enqueue = function (steamId64, cb) {
    var cached = this.getCached(steamId64);
    if (cached !== null) {
      try {
        cb(null, cached);
      } catch (e) {}
      return;
    }

    if (!this.waiters[steamId64]) this.waiters[steamId64] = [];
    this.waiters[steamId64].push(cb);

    if (this.queued[steamId64]) return;
    this.queued[steamId64] = true;
    this.queue.push(steamId64);
    this.pump();
  };

  CblReputationService.prototype.pump = function () {
    var self = this;
    if (this.running) return;
    this.running = true;

    function step() {
      if (!self.queue.length) {
        self.running = false;
        return;
      }
      var steamId64 = self.queue.shift();
      var cached = self.getCached(steamId64);
      if (cached !== null) {
        delete self.queued[steamId64];
        self.flushWaiters(steamId64, null, cached);
        setTimeout(step, 0);
        return;
      }

      var wait = self.minIntervalMs - (Date.now() - self.lastFetchAt);
      if (wait < 0) wait = 0;
      setTimeout(function () {
        CblGraphqlClient.fetchSteamUser(steamId64)
          .then(function (json) {
            self.lastFetchAt = Date.now();
            var mapped = mapCblResponse(json);
            if (self.shouldCachePayload(mapped)) self.setCached(steamId64, mapped);
            delete self.queued[steamId64];
            self.flushWaiters(steamId64, null, mapped);
          })
          .catch(function (err) {
            self.lastFetchAt = Date.now();
            delete self.queued[steamId64];
            self.flushWaiters(steamId64, err, null);
          })
          .then(function () {
            step();
          });
      }, wait);
    }

    step();
  };

  // --- CBL chip UI ----------------------------------------------------------
  // Gradient chip from RP/risk severity. Compact label on player list, full on profile.

  /**
   * Chip is shown only when CBL returns at least one of reputation points or risk rating.
   * @param {{ kind?: string, reputationPoints?: number|null, riskRating?: string|null }} data
   */
  function cblHasReputationOrRiskRating(data) {
    if (!data || data.kind !== 'ok') return false;
    if (data.reputationPoints != null && !Number.isNaN(Number(data.reputationPoints))) return true;
    if (data.riskRating != null && String(data.riskRating).trim() !== '') return true;
    return false;
  }

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function parseFloatFromRiskString(s) {
    if (s == null) return null;
    var str = String(s);
    var m = str.match(/([\d.]+)\s*\/\s*10/i);
    if (m) return parseFloat(m[1]) / 10;
    var n = parseFloat(str);
    if (Number.isNaN(n)) return null;
    if (n <= 10) return n / 10;
    return clamp01(n / 100);
  }

  /**
   * Higher = worse (more red). Prefers CBL risk string; falls back to RP scale.
   * @param {{ reputationPoints?: number|null, riskRating?: string|null }} data
   */
  function computeCblChipSeverity01(data) {
    var rr = parseFloatFromRiskString(data.riskRating);
    if (rr != null) return clamp01(rr);
    var rp = data.reputationPoints;
    if (rp != null && !Number.isNaN(Number(rp))) return clamp01(Number(rp) / 28);
    return 0.4;
  }

  /**
   * @param {HTMLAnchorElement} chip
   * @param {{ reputationPoints?: number|null, riskRating?: string|null }} data
   */
  function applyCblChipSeverityStyles(chip, data) {
    var sev = computeCblChipSeverity01(data);
    var hue = Math.round(118 * (1 - sev));
    var sat = 60 + Math.round(22 * sev);
    var lig = 47 - Math.round(12 * sev);
    var hue2 = Math.max(0, hue - 14);
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

  /**
   * Full CBL line for tooltips / profile chip label.
   * @param {{ reputationPoints?: number|null, riskRating?: string|null, reputationRank?: number|null }} data
   */
  function cblDetailParts(data) {
    var parts = [];
    if (data.reputationPoints != null) parts.push('RP ' + data.reputationPoints);
    if (data.riskRating != null && String(data.riskRating).trim() !== '') parts.push('Risk ' + data.riskRating);
    if (data.reputationRank != null) parts.push('#' + data.reputationRank);
    return parts;
  }

  /**
   * @param {string} steamId64
   * @param {{ reputationPoints?: number|null, riskRating?: string|null, reputationRank?: number|null, displayName?: string|null }} data
   * @param {string} [extraChipClass]
   * @param {'full'|'compact'} [labelMode] full = profile; compact = player list (CBL: 'RP', same gradient)
   * @returns {HTMLAnchorElement}
   */
  function buildCblChipElement(steamId64, data, extraChipClass, labelMode) {
    var mode = labelMode || 'full';
    var chip = document.createElement('a');
    chip.className = 'bss-toolkit-cbl-chip' + (extraChipClass ? ' ' + extraChipClass : '');
    chip.href = CBL_SEARCH_URL(steamId64);
    chip.target = '_blank';
    chip.rel = 'noopener noreferrer';

    var detailParts = cblDetailParts(data);
    var detailStr = detailParts.join(' · ');

    if (mode === 'compact') {
      var quotedVal;
      if (data.reputationPoints != null && !Number.isNaN(Number(data.reputationPoints))) {
        quotedVal = String(data.reputationPoints);
      } else if (data.riskRating != null && String(data.riskRating).trim() !== '') {
        quotedVal = String(data.riskRating).trim();
      } else {
        quotedVal = '—';
      }
      chip.textContent = "CBL: '" + quotedVal + "'";
      var tip = detailStr ? 'CBL · ' + detailStr : 'Community Ban List';
      if (data.displayName) chip.title = data.displayName + ' — ' + tip;
      else chip.title = tip;
      applyCblChipSeverityStyles(chip, data);
      return chip;
    }

    chip.textContent = 'CBL · ' + detailStr;
    if (data.displayName) chip.title = data.displayName + ' — Community Ban List';
    else chip.title = 'Community Ban List';

    applyCblChipSeverityStyles(chip, data);
    return chip;
  }

  var CblRatingChip = {
    /**
     * @param {HTMLElement} anchor
     * @param {HTMLElement} nameCol
     * @param {string} steamId64
     * @param {object} data
     * @param {string} chipClass
     * @param {'full'|'compact'} labelMode
     */
    insertAfterName: function (anchor, nameCol, steamId64, data, chipClass, labelMode) {
      if (!data || data.kind === 'error' || data.kind === 'notFound') return;
      if (!cblHasReputationOrRiskRating(data)) return;
      if (!nameCol.isConnected || !anchor.isConnected) return;
      if (nameCol.querySelector('[data-bss-cbl-for="' + steamId64 + '"]')) return;

      nameCol.classList.add('bss-toolkit-name-row');

      var wrap = document.createElement('span');
      wrap.className = 'bss-toolkit-cbl-wrap';
      wrap.setAttribute('data-bss-cbl-for', steamId64);

      var chip = buildCblChipElement(steamId64, data, chipClass, labelMode);
      wrap.appendChild(chip);
      anchor.insertAdjacentElement('afterend', wrap);
    },

    /**
     * @param {HTMLElement} nameCol
     * @param {string} steamId64
     * @param {CblReputationService} svc
     */
    mount: function (nameCol, steamId64, svc) {
      var anchor = nameCol.querySelector('a[href*="/rcon/players/"]');
      if (!anchor) return;
      if (nameCol.querySelector('[data-bss-cbl-for="' + steamId64 + '"]')) return;

      var onData = function (err, data) {
        if (err || !data) return;
        CblRatingChip.insertAfterName(anchor, nameCol, steamId64, data, 'bss-toolkit-cbl-chip--table', 'compact');
      };

      var cached = svc.getCached(steamId64);
      if (cached !== null) {
        onData(null, cached);
        return;
      }
      svc.enqueue(steamId64, onData);
    },

    /**
     * Same CBL chip as the server player list, placed in the profile page title row (h1).
     * @param {HTMLElement} h1El
     * @param {string} steamId64
     * @param {CblReputationService} svc
     */
    mountInHeader: function (h1El, steamId64, svc) {
      var path = location.pathname;
      if (h1El.querySelector('[data-bss-profile-header-cbl][data-bss-profile-path="' + path + '"]')) return;

      var onData = function (err, data) {
        if (h1El.getAttribute('data-bss-cbl-pending') === path) h1El.removeAttribute('data-bss-cbl-pending');
        if (err || !data || data.kind === 'error' || data.kind === 'notFound') return;
        if (!cblHasReputationOrRiskRating(data)) return;
        if (!h1El.isConnected || location.pathname !== path) return;

        var dup = h1El.querySelector('[data-bss-profile-header-cbl]');
        if (dup && dup.getAttribute('data-bss-profile-path') === path) return;

        var olds = h1El.querySelectorAll('[data-bss-profile-header-cbl]');
        for (var o = 0; o < olds.length; o++) olds[o].remove();

        h1El.classList.add('bss-toolkit-profile-h1-with-chip');

        var wrap = document.createElement('span');
        wrap.className = 'bss-toolkit-cbl-wrap bss-toolkit-cbl-wrap--profile-header';
        wrap.setAttribute('data-bss-profile-header-cbl', '1');
        wrap.setAttribute('data-bss-profile-path', path);

        var chip = buildCblChipElement(steamId64, data, 'bss-toolkit-cbl-chip--profile-header', 'full');
        wrap.appendChild(chip);
        h1El.appendChild(wrap);
      };

      var cached = svc.getCached(steamId64);
      if (cached !== null) {
        onData(null, cached);
        return;
      }

      h1El.setAttribute('data-bss-cbl-pending', path);
      svc.enqueue(steamId64, onData);
    }
  };

  // --- Connected players panel ----------------------------------------------
  // Watches div[data-session] rows: CBL chip, BM flag tint, admin-tag name, filter.
  // scheduleReconcile (400ms) catches virtual-scroll recycled rows.

  function ConnectedPlayersPanel(cblService, getRules, getPlayerFilter) {
    this.cblService = cblService;
    this.getRules = getRules;
    this.getPlayerFilter = getPlayerFilter;
    this.observer = null;
    this.reconcileTimer = null;
  }

  ConnectedPlayersPanel.prototype.rowHasCblChip = function (rowEl, steamId64) {
    var nameCol = rowEl.querySelector('div.name');
    return !!(nameCol && nameCol.querySelector('[data-bss-cbl-for="' + steamId64 + '"]'));
  };

  ConnectedPlayersPanel.prototype.processRow = function (rowEl) {
    var parsed = parsePlayerRow(rowEl);
    if (!parsed) {
      if (rowEl.getAttribute('data-session')) rowEl.setAttribute(PROCESSED_ATTR, '0');
      return;
    }

    // Always refresh row visuals first: virtual scroll recycles row nodes for
    // different players, so name color, BM-flag tint, and filter state must be
    // recomputed every pass (not gated behind the CBL-chip early-return below).
    AdminTagNameStyler.applyToPlayerRow(parsed);
    HighlightRuleEngine.applyPlayer(this.getRules(), parsed);
    this.applyPlayerFilter(parsed);

    // CBL chip is expensive (network) and stable per steamId, so only mount it
    // once per row+id. Bail out once the chip for this id is already present.
    var hasChip = this.rowHasCblChip(rowEl, parsed.steamId64);
    if (rowEl.getAttribute(PROCESSED_ATTR) === '1' && hasChip) return;

    rowEl.setAttribute(PROCESSED_ATTR, '1');

    var nameCol = rowEl.querySelector('div.name');
    if (nameCol && !hasChip) CblRatingChip.mount(nameCol, parsed.steamId64, this.cblService);
  };

  ConnectedPlayersPanel.prototype.processAddedNode = function (node) {
    if (!node || node.nodeType !== 1) return;
    var el = /** @type {HTMLElement} */ (node);
    if (el.matches && el.matches('div[data-session]')) this.processRow(el);
    if (el.querySelectorAll) {
      var rows = el.querySelectorAll('div[data-session]');
      for (var i = 0; i < rows.length; i++) this.processRow(rows[i]);
    }
  };

  ConnectedPlayersPanel.prototype.scheduleReconcile = function () {
    var self = this;
    if (this.reconcileTimer) return;
    this.reconcileTimer = setTimeout(function () {
      self.reconcileTimer = null;
      // Reprocess every row: processRow refreshes visuals cheaply and self-gates
      // the costly CBL chip mount, so recycled rows always get correct tinting.
      var rows = document.querySelectorAll('div[data-session]');
      for (var i = 0; i < rows.length; i++) self.processRow(rows[i]);
    }, 400);
  };

  ConnectedPlayersPanel.prototype.applyPlayerFilter = function (parsed) {
    var f = (this.getPlayerFilter() || '').trim();
    if (!f) {
      parsed.rowEl.classList.remove('bss-toolkit-player-filtered');
      return;
    }
    var hay = playerRowSearchBlob(parsed);
    var match = false;
    if (f.length >= 2 && f[0] === '/' && f.lastIndexOf('/') > 0) {
      try {
        var re = new RegExp(f.slice(1, f.lastIndexOf('/')), f.slice(f.lastIndexOf('/') + 1) || 'i');
        match = re.test(hay);
      } catch (e) {
        match = hay.indexOf(f.toLowerCase()) !== -1;
      }
    } else {
      match = hay.indexOf(f.toLowerCase()) !== -1;
    }
    if (match) parsed.rowEl.classList.remove('bss-toolkit-player-filtered');
    else parsed.rowEl.classList.add('bss-toolkit-player-filtered');
  };

  ConnectedPlayersPanel.prototype.scan = function () {
    var rows = document.querySelectorAll('div[data-session]');
    for (var i = 0; i < rows.length; i++) this.processRow(rows[i]);
  };

  ConnectedPlayersPanel.prototype.refilterAll = function () {
    var rows = document.querySelectorAll('div[data-session]');
    for (var i = 0; i < rows.length; i++) {
      var parsed = parsePlayerRow(rows[i]);
      if (parsed) this.applyPlayerFilter(parsed);
    }
  };

  /** Re-apply BM flag / accent styling after settings change (without duplicating CBL chips). */
  ConnectedPlayersPanel.prototype.refreshPlayerRowVisuals = function () {
    var rows = document.querySelectorAll('div[data-session][data-bss-processed="1"]');
    for (var i = 0; i < rows.length; i++) {
      var parsed = parsePlayerRow(rows[i]);
      if (!parsed) continue;
      AdminTagNameStyler.applyToPlayerRow(parsed);
      HighlightRuleEngine.applyPlayer(this.getRules(), parsed);
      this.applyPlayerFilter(parsed);
    }
  };

  /**
   * After SPA navigation the same DOM nodes may be gone or reused; clear our markers and re-run.
   */
  ConnectedPlayersPanel.prototype.prepareForSpaRescan = function () {
    var rows = document.querySelectorAll('div[data-session]');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      row.removeAttribute(PROCESSED_ATTR);
      var wraps = row.querySelectorAll('.bss-toolkit-cbl-wrap');
      for (var w = 0; w < wraps.length; w++) wraps[w].remove();
      var nameCol = row.querySelector('div.name');
      if (nameCol) nameCol.classList.remove('bss-toolkit-name-row');
      stripBssToolkitClassesFromElement(row);
    }
    this.scan();
  };

  ConnectedPlayersPanel.prototype.stop = function () {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.reconcileTimer) {
      clearTimeout(this.reconcileTimer);
      this.reconcileTimer = null;
    }
  };

  ConnectedPlayersPanel.prototype.start = function () {
    var self = this;
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.cblService.loadCache();
    this.scan();
    this.observer = new MutationObserver(function (mutations) {
      for (var m = 0; m < mutations.length; m++) {
        var mu = mutations[m];
        if (mu.type === 'childList') {
          var target = mu.target;
          if (target instanceof HTMLElement && target.matches && target.matches('div[data-session]')) {
            self.processRow(target);
          }
          var added = mu.addedNodes;
          for (var j = 0; j < added.length; j++) {
            self.processAddedNode(added[j]);
          }
        }
      }
      self.scheduleReconcile();
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  };

  // --- RCON live feed -------------------------------------------------------
  // Server dashboard feed: phrase colors, highlight rules, optional text filter.
  // reconcileAll every 300ms handles virtual-scroll row recycling.

  function RconLiveFeed(getRules, getFeedFilter) {
    this.getRules = getRules;
    this.getFeedFilter = getFeedFilter;
    this.observer = null;
    this.reconcileInterval = null;
  }

  RconLiveFeed.prototype.applyFeedEnhancements = function (lineEl) {
    if (!isFeedLineStructure(lineEl)) return;
    FeedTextColorEngine.applyToLine(lineEl);
  };

  RconLiveFeed.prototype.processLine = function (lineEl) {
    if (!isRconFeedLine(lineEl)) return;
    lineEl.setAttribute(FEED_PROCESSED_ATTR, '1');

    var text = getFeedLineText(lineEl);
    HighlightRuleEngine.applyFeed(this.getRules(), lineEl, text);
    this.applyFeedFilter(lineEl, text);
    this.applyFeedEnhancements(lineEl);
  };

  RconLiveFeed.prototype.reconcileAll = function () {
    var self = this;
    var times = document.querySelectorAll('time');
    for (var i = 0; i < times.length; i++) {
      var lineEl = resolveFeedLineContainer(times[i].parentElement);
      if (lineEl && isRconFeedLine(lineEl)) self.processLine(lineEl);
    }
    FeedColorEnhancer.reconcileDocument({
      applyHighlightRules: true,
      applyFeedFilter: true,
      feedFilterFn: function (lineEl, text) {
        self.applyFeedFilter(lineEl, text);
      },
      applyModalStyles: true
    });
  };

  RconLiveFeed.prototype.applyFeedFilter = function (lineEl, text) {
    var f = (this.getFeedFilter() || '').trim();
    if (!f) {
      lineEl.classList.remove('bss-toolkit-feed-filtered');
      return;
    }
    var hay = text.toLowerCase();
    var match = false;
    if (f.length >= 2 && f[0] === '/' && f.lastIndexOf('/') > 0) {
      try {
        var re = new RegExp(f.slice(1, f.lastIndexOf('/')), f.slice(f.lastIndexOf('/') + 1) || 'i');
        match = re.test(hay);
      } catch (e) {
        match = hay.indexOf(f.toLowerCase()) !== -1;
      }
    } else {
      match = hay.indexOf(f.toLowerCase()) !== -1;
    }
    if (match) lineEl.classList.remove('bss-toolkit-feed-filtered');
    else lineEl.classList.add('bss-toolkit-feed-filtered');
  };

  RconLiveFeed.prototype.scan = function () {
    var times = document.querySelectorAll('time');
    for (var i = 0; i < times.length; i++) {
      var lineEl = resolveFeedLineContainer(times[i].parentElement);
      if (lineEl && isRconFeedLine(lineEl)) this.processLine(lineEl);
    }
  };

  RconLiveFeed.prototype.refilterAll = function () {
    var all = document.querySelectorAll('div[' + FEED_PROCESSED_ATTR + '="1"]');
    for (var i = 0; i < all.length; i++) {
      var lineEl = all[i];
      var text = getFeedLineText(lineEl);
      this.applyFeedFilter(lineEl, text);
    }
  };

  RconLiveFeed.prototype.stripLineDecoration = function (lineEl) {
    lineEl.removeAttribute(FEED_PROCESSED_ATTR);
    stripBssToolkitClassesFromElement(lineEl);
    var msg = getFeedMessageElement(lineEl);
    if (msg) msg.style.color = '';
  };

  RconLiveFeed.prototype.prepareForSpaRescan = function () {
    var marked = document.querySelectorAll('div[' + FEED_PROCESSED_ATTR + ']');
    for (var i = 0; i < marked.length; i++) this.stripLineDecoration(marked[i]);
    this.scan();
  };

  RconLiveFeed.prototype.stop = function () {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.reconcileInterval) {
      clearInterval(this.reconcileInterval);
      this.reconcileInterval = null;
    }
  };

  RconLiveFeed.prototype.start = function () {
    var self = this;
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
    this.reconcileInterval = setInterval(function () {
      self.reconcileAll();
    }, 300);

    this.observer = new MutationObserver(function (mutations) {
      for (var m = 0; m < mutations.length; m++) {
        var mu = mutations[m];
        for (var j = 0; j < mu.addedNodes.length; j++) {
          var n = mu.addedNodes[j];
          if (n.nodeType !== 1) continue;
          if (isRconFeedLine(n)) self.processLine(n);
          // Resolve from each added <time> up to its feed row (handles the
          // <span><time></span><div> layout where the row is an ancestor).
          var innerTimes = n.querySelectorAll && n.querySelectorAll('time');
          if (innerTimes) {
            for (var k = 0; k < innerTimes.length; k++) {
              var lineEl = resolveFeedLineContainer(innerTimes[k].parentElement);
              if (lineEl && isRconFeedLine(lineEl)) self.processLine(lineEl);
            }
          }
        }
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  };

  // --- Player profile: shared DOM scheduler ---------------------------------
  // One MutationObserver (50ms debounce) runs registered tasks + activity log colors.
  // colorInterval (300ms) re-applies feed colors on virtual-scrolled activity log.

  /**
   * Profile activity log root (#RCONPlayerPage or main).
   * @returns {ParentNode}
   */
  function findProfileActivityLogRoot() {
    return document.querySelector('#RCONPlayerPage') || document.querySelector('main') || document;
  }

  var ProfilePageRunner = {
    observer: null,
    timer: null,
    colorInterval: null,
    tasks: [],

    register: function (fn) {
      this.tasks.push(fn);
    },

    reconcileActivityLog: function () {
      if (!/\/rcon\/players\/\d+/.test(location.pathname)) return;
      FeedColorEnhancer.reconcileDocument({
        scopeRoot: findProfileActivityLogRoot(),
        applyHighlightRules: true
      });
    },

    runAll: function () {
      if (!/\/rcon\/players\/\d+/.test(location.pathname)) return;
      for (var i = 0; i < this.tasks.length; i++) {
        try {
          this.tasks[i]();
        } catch (e) {}
      }
      this.reconcileActivityLog();
      AdminTagNameStyler.applyToProfileHeader();
    },

    schedule: function () {
      var self = this;
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(function () {
        self.timer = null;
        self.runAll();
      }, 50);
    },

    stop: function () {
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

    start: function () {
      var self = this;
      if (this.observer) return;
      if (this.colorInterval) clearInterval(this.colorInterval);
      this.colorInterval = setInterval(function () {
        self.reconcileActivityLog();
      }, 300);
      this.runAll();
      this.observer = new MutationObserver(function () {
        self.schedule();
      });
      this.observer.observe(document.body, { childList: true, subtree: true });
    }
  };

  // --- Player profile: identifier extraction + copy helpers -----------------
  // Used by CBL header chip, Copy Player Info, and Note Menu templates.

  var PROFILE_HEADER_CBL_ATTR = 'data-bss-profile-header-cbl';

  /**
   * Identifiers table row by Type column label (Overview + Identifiers tab).
   * @param {RegExp} typeRe
   * @returns {HTMLTableCellElement|null}
   */
  function profileIdentifierCellByType(typeRe) {
    var typeCells = document.querySelectorAll('td[data-title="Type"]');
    for (var i = 0; i < typeCells.length; i++) {
      var typeText = normalizeWs(typeCells[i].textContent || '');
      if (!typeRe.test(typeText)) continue;
      var row = typeCells[i].closest('tr');
      if (!row) continue;
      var idCell = row.querySelector('td[data-title="Identifier"]');
      if (idCell) return idCell;
    }
    return null;
  }

  /**
   * @param {HTMLElement|null} cell
   */
  function identifierTextFromCell(cell) {
    if (!cell) return '';
    var titled = cell.querySelector('[title]');
    if (titled && titled.getAttribute('title')) {
      var fromTitle = normalizeWs(titled.getAttribute('title') || '');
      if (fromTitle) return fromTitle;
    }
    return normalizeWs(cell.textContent || '');
  }

  /**
   * Identifiers pane uses table cells or span.css-q39y9k with SteamID64 in `title`.
   * @returns {string|null}
   */
  function extractSteamId64FromProfileIdentifiers() {
    var fromTable = identifierTextFromCell(profileIdentifierCellByType(/steam/i));
    if (STEAM_ID64_RE.test(fromTable)) return fromTable.match(STEAM_ID64_RE)[0];

    var spans = document.querySelectorAll('span.css-q39y9k[title]');
    for (var i = 0; i < spans.length; i++) {
      var title = normalizeWs(spans[i].getAttribute('title') || '');
      if (STEAM_ID64_RE.test(title)) return title.match(STEAM_ID64_RE)[0];
    }
    for (var j = 0; j < spans.length; j++) {
      var raw = normalizeWs(spans[j].textContent || '');
      if (STEAM_ID64_RE.test(raw)) return raw.match(STEAM_ID64_RE)[0];
    }
    return null;
  }

  /**
   * @returns {string}
   */
  function extractEosIdFromProfile() {
    var fromTable = identifierTextFromCell(profileIdentifierCellByType(/eos/i));
    if (EOS_ID_RE.test(fromTable)) return fromTable.match(EOS_ID_RE)[0];

    var table = document.querySelector('td[data-title="Type"]');
    var scope = table ? table.closest('table, section, main') || document : document;
    var nodes = scope.querySelectorAll('span[title], div[title], span.css-q39y9k');
    for (var i = 0; i < nodes.length; i++) {
      var raw = normalizeWs(nodes[i].getAttribute('title') || nodes[i].textContent || '');
      if (EOS_ID_RE.test(raw)) return raw.match(EOS_ID_RE)[0];
    }
    return '';
  }

  /**
   * @returns {string}
   */
  function extractProfilePlayerName() {
    var fromTable = identifierTextFromCell(profileIdentifierCellByType(/^name$/i));
    if (fromTable) return fromTable;
    var h1 = findProfilePageH1();
    if (h1) return normalizeWs(h1.textContent || '');
    return '';
  }

  /**
   * Crime / expiry from active player notes (Desktop toolkit parity).
   * @returns {{ crime: string, time: string }}
   */
  function extractProfileNoteCrimeTime() {
    var span =
      document.querySelector('.collapse.in ul li a span') ||
      document.querySelector('.collapse.show ul li a span') ||
      document.querySelector('[class*="collapse"] ul li a span');
    var raw = span ? normalizeWs(span.textContent || '') : '';
    if (!raw) return { crime: '', time: '' };
    var crime = '';
    var time = '';
    var dashParts = raw.split(' - ');
    if (dashParts.length > 1) {
      crime = dashParts[1].split(' | Expires')[0].trim();
    }
    var m = raw.match(/\| Expires:\s*([^|]+)/i);
    if (m) time = m[1].trim();
    return { crime: crime, time: time };
  }

  /**
   * @returns {{ name: string, steam64: string, eos: string, crime: string, time: string }}
   */
  function extractProfilePlayerCopyInfo() {
    var notes = extractProfileNoteCrimeTime();
    return {
      name: extractProfilePlayerName(),
      steam64: extractSteamId64FromProfileIdentifiers() || '',
      eos: extractEosIdFromProfile(),
      crime: notes.crime,
      time: notes.time
    };
  }

  /**
   * @param {{ name: string, steam64: string, eos: string, crime?: string, time?: string }} info
   */
  function formatCopyPlayerInfoBlock(info) {
    return (
      'Name : ' +
      (info.name || '') +
      '\n' +
      'Steam64 : ' +
      (info.steam64 || '') +
      '\n' +
      'EOS : ' +
      (info.eos || '') +
      '\n' +
      'Crime : ' +
      (info.crime || '') +
      '\n' +
      'Time : ' +
      (info.time || '') +
      '\n' +
      'Evidence/Note : \n'
    );
  }

  var NOTE_TEMPLATE_VERBS = {
    Warn: 'Warned',
    Kick: 'Kicked'
  };

  var NOTE_TEMPLATE_REASONS = [
    'Trolling',
    'Teamkilling',
    'Asset Wasting',
    'Squad Edging',
    'Armor Rules',
    'MBT Rules',
    'Heli Rules',
    'Maincamping',
    'Practice flying',
    'Seeding Rules',
    'Spawn Camping',
    'No Mic SL'
  ];

  var NOTE_TEMPLATE_DETAILS = {
    Trolling: 'Trolling',
    Teamkilling: 'Teamkilling',
    'Asset Wasting': 'Asset Wasting',
    'Squad Edging': 'Squad Seeding',
    'Armor Rules': 'Breaking Armor Rules, leaving Main without a second Crewman',
    'MBT Rules': 'Breaking MBT Rules, having INF in a MBT squad',
    'Heli Rules':
      'Breaking Heli Rules, Flying a Heli with a Squad with more than 4 people in the Squad',
    Maincamping: 'Maincamping',
    'Practice flying': 'Not being able to Fly the Heli without Crashing',
    'Seeding Rules': 'Breaking Seeding Rules',
    'Spawn Camping': 'Spawn Camping on Jensens',
    'No Mic SL': 'having No Mic as SL'
  };

  /**
   * @param {string} text
   */
  function fillProfileNoteEditor(text) {
    var t = document.querySelector('.tiptap.ProseMirror[contenteditable="true"]');
    if (!t) return false;
    t.innerHTML = '<p>' + text + '</p>';
    t.focus();
    try {
      var sel = window.getSelection();
      if (sel) sel.collapse(t, 1);
    } catch (e) {}
    return true;
  }

  /**
   * @param {'Warn'|'Kick'} action
   * @param {string} reasonKey
   */
  function buildNoteTemplateText(action, reasonKey) {
    var verb = NOTE_TEMPLATE_VERBS[action] || 'Warned';
    var detail = NOTE_TEMPLATE_DETAILS[reasonKey] || reasonKey;
    return 'Player was ' + verb + ' for ' + detail;
  }

  /**
   * Battlemetrics player profile title; emotion class may change — fall back to main/article h1.
   * @returns {HTMLHeadingElement|null}
   */
  function findProfilePageH1() {
    var el = document.querySelector('h1.css-8uhtka');
    if (el) return el;
    el = document.querySelector('main h1');
    if (el) return el;
    el = document.querySelector('article h1');
    if (el) return el;
    return document.querySelector('h1');
  }

  // --- Player profile: CBL chip in page header ------------------------------

  var PlayerProfileCblLink = {
    removeStaleInjections: function () {
      var nodes = document.querySelectorAll('[' + PROFILE_HEADER_CBL_ATTR + ']');
      for (var i = 0; i < nodes.length; i++) {
        var p = nodes[i].getAttribute('data-bss-profile-path');
        if (p && p !== location.pathname) {
          var par = nodes[i].parentElement;
          nodes[i].remove();
          if (par && par.tagName === 'H1') {
            par.classList.remove('bss-toolkit-profile-h1-with-chip');
            par.removeAttribute('data-bss-cbl-pending');
          }
        }
      }
    },

    run: function () {
      if (!/\/rcon\/players\/\d+/.test(location.pathname)) return;

      this.removeStaleInjections();

      var h1 = findProfilePageH1();
      if (!h1) return;

      var existing = h1.querySelector('[' + PROFILE_HEADER_CBL_ATTR + ']');
      if (existing && existing.getAttribute('data-bss-profile-path') === location.pathname) return;
      if (h1.getAttribute('data-bss-cbl-pending') === location.pathname) return;

      var steamId = extractSteamId64FromProfileIdentifiers();
      if (!steamId) return;

      if (!profilePageCblService) {
        profilePageCblService = new CblReputationService();
        profilePageCblService.loadCache();
      }

      CblRatingChip.mountInHeader(h1, steamId, profilePageCblService);
    }
  };

  // --- Player profile: Overview actions (copy + note menu) --------------------
  // Mounted under h1 on Overview tab only. Note menu fills .tiptap.ProseMirror editor.

  var PROFILE_OVERVIEW_ACTIONS_ATTR = 'data-bss-profile-overview-actions';

  var PROFILE_TAB_LABEL_RE = /^(Overview|Identifiers|Flags|Activity|Sessions|Related Players)$/i;

  /**
   * Player profile sub-nav tabs (Overview, Identifiers, …).
   * @returns {HTMLAnchorElement[]}
   */
  function profileSubnavTabLinks() {
    var idMatch = location.pathname.match(/\/rcon\/players\/(\d+)/);
    if (!idMatch) return [];
    var playerId = idMatch[1];
    var links = document.querySelectorAll('a[href*="/rcon/players/' + playerId + '"]');
    var out = [];
    for (var i = 0; i < links.length; i++) {
      var label = normalizeWs(links[i].textContent || '');
      if (!PROFILE_TAB_LABEL_RE.test(label)) continue;
      out.push(links[i]);
    }
    return out;
  }

  /**
   * Copy button only on Overview (not Identifiers / Flags / Activity / …).
   */
  function isProfileOverviewTab() {
    if (!/\/rcon\/players\/\d+/.test(location.pathname)) return false;

    var sub = location.pathname.match(/\/rcon\/players\/\d+\/([^/?#]+)/i);
    if (sub && sub[1].toLowerCase() !== 'overview') return false;

    var tabs = profileSubnavTabLinks();
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].getAttribute('aria-current') === 'page') {
        return /^overview$/i.test(normalizeWs(tabs[i].textContent || ''));
      }
    }

    return !sub;
  }

  /**
   * Mount directly under the player name heading (Overview layout).
   * @returns {HTMLHeadingElement|null}
   */
  function findProfileCopyAnchorH1() {
    var h1 = findProfilePageH1();
    if (!h1 || !h1.parentElement) return null;
    if (!normalizeWs(h1.textContent || '')) return null;
    return h1;
  }

  var PlayerProfileOverviewUi = {
    outsideClickBound: false,

    removeAll: function () {
      var nodes = document.querySelectorAll('[' + PROFILE_OVERVIEW_ACTIONS_ATTR + ']');
      for (var i = 0; i < nodes.length; i++) nodes[i].remove();
    },

    removeStaleInjections: function () {
      var nodes = document.querySelectorAll('[' + PROFILE_OVERVIEW_ACTIONS_ATTR + ']');
      for (var i = 0; i < nodes.length; i++) {
        var p = nodes[i].getAttribute('data-bss-profile-path');
        if (p && p !== location.pathname) nodes[i].remove();
      }
    },

    buildNoteMenu: function (root) {
      var wrap = document.createElement('div');
      wrap.className = 'bss-toolkit-note-menu';

      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'bss-toolkit-btn bss-toolkit-btn--block';
      toggle.textContent = 'Note Menu';

      var menu = document.createElement('div');
      menu.className = 'bss-toolkit-note-dropdown';

      var submenu = document.createElement('div');
      submenu.className = 'bss-toolkit-note-dropdown bss-toolkit-note-submenu';

      function closeAll() {
        menu.classList.remove('is-open');
        submenu.classList.remove('is-open');
      }

      ['Warn', 'Kick'].forEach(function (action) {
        var item = document.createElement('button');
        item.type = 'button';
        item.textContent = action;
        item.addEventListener('click', function (e) {
          e.stopPropagation();
          submenu.innerHTML = '';
          NOTE_TEMPLATE_REASONS.forEach(function (reason) {
            var reasonBtn = document.createElement('button');
            reasonBtn.type = 'button';
            reasonBtn.textContent = reason;
            reasonBtn.addEventListener('click', function (ev) {
              ev.stopPropagation();
              fillProfileNoteEditor(buildNoteTemplateText(action, reason));
              closeAll();
            });
            submenu.appendChild(reasonBtn);
          });
          submenu.classList.add('is-open');
          menu.classList.remove('is-open');
        });
        menu.appendChild(item);
      });

      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = menu.classList.contains('is-open');
        closeAll();
        if (!open) menu.classList.add('is-open');
      });

      if (!PlayerProfileOverviewUi.outsideClickBound) {
        PlayerProfileOverviewUi.outsideClickBound = true;
        document.addEventListener('click', function () {
          var opens = document.querySelectorAll(
            '.bss-toolkit-note-dropdown.is-open, .bss-toolkit-note-submenu.is-open'
          );
          for (var i = 0; i < opens.length; i++) opens[i].classList.remove('is-open');
        });
      }

      wrap.appendChild(toggle);
      wrap.appendChild(menu);
      wrap.appendChild(submenu);
      root.appendChild(wrap);
    },

    onCopyClick: function (btn) {
      var info = extractProfilePlayerCopyInfo();
      var text = formatCopyPlayerInfoBlock(info);
      var label = btn.getAttribute('data-label-default') || 'Copy Player Info';
      copyTextToClipboard(text, function (ok) {
        if (!ok) {
          btn.textContent = 'Copy failed';
          setTimeout(function () {
            btn.textContent = label;
          }, 1600);
          return;
        }
        btn.textContent = 'Copied!';
        btn.classList.add('bss-toolkit-btn--copied');
        setTimeout(function () {
          btn.textContent = label;
          btn.classList.remove('bss-toolkit-btn--copied');
        }, 1400);
      });
    },

    run: function () {
      if (!/\/rcon\/players\/\d+/.test(location.pathname)) return;

      this.removeStaleInjections();

      if (!isProfileOverviewTab()) {
        this.removeAll();
        return;
      }

      var h1 = findProfileCopyAnchorH1();
      if (!h1) {
        this.removeAll();
        return;
      }

      var existing = document.querySelector('[' + PROFILE_OVERVIEW_ACTIONS_ATTR + ']');
      if (
        existing &&
        existing.getAttribute('data-bss-profile-path') === location.pathname &&
        existing.previousElementSibling === h1
      ) {
        return;
      }

      if (existing) existing.remove();

      var root = document.createElement('div');
      root.className = 'bss-toolkit-profile-actions';
      root.setAttribute(PROFILE_OVERVIEW_ACTIONS_ATTR, '1');
      root.setAttribute('data-bss-profile-path', location.pathname);

      var copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'bss-toolkit-btn bss-toolkit-btn--block bss-toolkit-btn--primary';
      copyBtn.textContent = 'Copy Player Info';
      copyBtn.setAttribute('data-label-default', 'Copy Player Info');
      copyBtn.addEventListener('click', function () {
        PlayerProfileOverviewUi.onCopyClick(copyBtn);
      });
      root.appendChild(copyBtn);

      this.buildNoteMenu(root);
      h1.insertAdjacentElement('afterend', root);
    }
  };

  // Register profile-page tasks with the shared scheduler (order matters: CBL, then Overview UI).
  ProfilePageRunner.register(function () {
    PlayerProfileCblLink.run();
  });
  ProfilePageRunner.register(function () {
    PlayerProfileOverviewUi.run();
  });

  // --- Toolkit app: bootstrap + SPA routing ---------------------------------
  // Starts/stops server dashboard vs profile runner based on URL.
  // Watches history.pushState/replaceState because Battlemetrics is a SPA.

  /** @returns {HighlightRule[]} */
  function getHighlightRules() {
    var r = storageGet('highlightRules', DEFAULT_RULES);
    return Array.isArray(r) ? r : DEFAULT_RULES;
  }

  function getPlayerFilter() {
    return String(storageGet('playerFilter', '') || '');
  }

  function getFeedFilter() {
    return String(storageGet('feedFilter', '') || '');
  }

  /** Tear down server observers when leaving server dashboard. */
  function teardownServerDashboard() {
    if (bmToolkitServer.players) {
      bmToolkitServer.players.stop();
      bmToolkitServer.players = null;
    }
    if (bmToolkitServer.feed) {
      bmToolkitServer.feed.stop();
      bmToolkitServer.feed = null;
    }
    bmToolkitServer.cbl = null;
    steamBanLookup = null;
  }

  /** Start ConnectedPlayersPanel + RconLiveFeed + shared CBL service. */
  function startServerDashboard() {
    if (bmToolkitServer.players) return;

    var cbl = new CblReputationService();
    var players = new ConnectedPlayersPanel(cbl, getHighlightRules, getPlayerFilter);
    var feed = new RconLiveFeed(getHighlightRules, getFeedFilter);

    steamBanLookup = new SteamBanLookup();
    steamBanLookup.onUpdate = function () {
      players.refreshPlayerRowVisuals();
    };

    players.start();
    feed.start();

    bmToolkitServer.players = players;
    bmToolkitServer.feed = feed;
    bmToolkitServer.cbl = cbl;
  }

  var routeLastHref = '';

  /**
   * Route switcher: profile pages vs server 34935347 vs everything else.
   * Cleans injected profile DOM when navigating away.
   */
  function applyBattlemetricsRoute() {
    var path = location.pathname;
    var isProfile = /\/rcon\/players\/\d+/.test(path);
    var isOurServer = MATCHED_SERVER_PATH_RE.test(path);

    if (isProfile) {
      teardownServerDashboard();
      if (!profilePageCblService) {
        profilePageCblService = new CblReputationService();
      }
      profilePageCblService.loadCache();
      ProfilePageRunner.start();
      ProfilePageRunner.schedule();
      return;
    }

    ProfilePageRunner.stop();
    var inj = document.querySelectorAll('[' + PROFILE_HEADER_CBL_ATTR + ']');
    for (var i = 0; i < inj.length; i++) {
      var w = inj[i];
      var par = w.parentElement;
      w.remove();
      if (par && par.tagName === 'H1') {
        par.classList.remove('bss-toolkit-profile-h1-with-chip');
        par.removeAttribute('data-bss-cbl-pending');
      }
    }

    var copyRoots = document.querySelectorAll('[' + PROFILE_OVERVIEW_ACTIONS_ATTR + ']');
    for (var c = 0; c < copyRoots.length; c++) copyRoots[c].remove();

    if (isOurServer) {
      if (bmToolkitServer.players && bmToolkitServer.feed) {
        bmToolkitServer.players.prepareForSpaRescan();
        bmToolkitServer.feed.prepareForSpaRescan();
      } else {
        startServerDashboard();
      }
    } else {
      teardownServerDashboard();
    }
  }

  function installBattlemetricsRouteWatcher() {
    var debounceTimer = null;
    function onUrlMaybeChanged() {
      if (location.href === routeLastHref) return;
      routeLastHref = location.href;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        debounceTimer = null;
        try {
          applyBattlemetricsRoute();
        } catch (e) {}
      }, 60);
    }

    routeLastHref = location.href;
    window.addEventListener('popstate', onUrlMaybeChanged);

    var _pushState = history.pushState;
    var _replaceState = history.replaceState;
    history.pushState = function () {
      var r = _pushState.apply(this, arguments);
      onUrlMaybeChanged();
      return r;
    };
    history.replaceState = function () {
      var r = _replaceState.apply(this, arguments);
      onUrlMaybeChanged();
      return r;
    };

    setInterval(function () {
      if (location.href !== routeLastHref) onUrlMaybeChanged();
    }, 750);
  }

  function initBattlemetricsToolkit() {
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
})();
