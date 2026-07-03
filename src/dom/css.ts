/**
 * Injected once at init. Class prefix: `bss-toolkit-`.
 *
 * Kept as a JS string (not an imported `.css` file) on purpose: the rules include
 * Battlemetrics' generated emotion classes (`css-*`), `!important`, and units like
 * `100vw`/`100pt` that a CSS minifier could mangle or drop. Building the `<style>`
 * text in JS guarantees byte-identical output.
 */
export const CssInjector = {
  injected: false,

  buildRules(): string[] {
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
      '}',
    ];
  },

  inject(): void {
    if (this.injected) return;
    this.injected = true;
    const style = document.createElement('style');
    style.setAttribute('data-bss-toolkit', '1');
    style.textContent = this.buildRules().join('\n');
    (document.head || document.documentElement).appendChild(style);
  },
};
