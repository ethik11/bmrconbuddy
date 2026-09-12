import { SETTINGS_GEAR_ATTR, SETTINGS_PANEL_ATTR } from '../constants';
import {
  getColorRowsByBmFlags,
  getThemeSettings,
  resetThemeSettings,
  setColorRowsByBmFlags,
  setThemeSettings,
} from '../app/state';
import { registerToolkitMenuCommand } from '../platform/menu';
import { applyThemeCssVars, THEME_FIELD_GROUPS, THEME_KEYS, type ThemeKey } from './defaults';

const GEAR_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
  '<path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64L4.86 10.7c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.16a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.6.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.05.24.26.42.49.42h3.8c.23 0 .44-.18.49-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.23.1.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/>' +
  '</svg>';

function isThemeKey(value: string): value is ThemeKey {
  return (THEME_KEYS as readonly string[]).indexOf(value) !== -1;
}

function syncInputs(panel: HTMLElement): void {
  const theme = getThemeSettings();
  const inputs = panel.querySelectorAll<HTMLInputElement>('input[data-bss-theme-key]');
  for (let i = 0; i < inputs.length; i++) {
    const key = inputs[i].getAttribute('data-bss-theme-key');
    if (key && isThemeKey(key)) inputs[i].value = theme[key];
  }
  const flags = panel.querySelector<HTMLInputElement>('input[data-bss-settings-flags]');
  if (flags) flags.checked = getColorRowsByBmFlags();
}

function buildPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.setAttribute(SETTINGS_PANEL_ATTR, '1');
  panel.className = 'bss-toolkit-settings-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'bss-toolkit-settings-title');
  panel.setAttribute('hidden', '');

  const header = document.createElement('div');
  header.className = 'bss-toolkit-settings-header';
  const title = document.createElement('h2');
  title.id = 'bss-toolkit-settings-title';
  title.textContent = 'RCON Buddy';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'bss-toolkit-settings-close';
  close.setAttribute('aria-label', 'Close settings');
  close.textContent = '×';
  header.appendChild(title);
  header.appendChild(close);
  panel.appendChild(header);

  const body = document.createElement('div');
  body.className = 'bss-toolkit-settings-body';

  for (let g = 0; g < THEME_FIELD_GROUPS.length; g++) {
    const group = THEME_FIELD_GROUPS[g];
    const section = document.createElement('section');
    const heading = document.createElement('h3');
    heading.textContent = group.title;
    section.appendChild(heading);
    for (let i = 0; i < group.fields.length; i++) {
      const field = group.fields[i];
      const row = document.createElement('label');
      row.className = 'bss-toolkit-settings-row';
      const caption = document.createElement('span');
      caption.textContent = field.label;
      const input = document.createElement('input');
      input.type = 'color';
      input.setAttribute('data-bss-theme-key', field.key);
      input.setAttribute('aria-label', field.label);
      row.appendChild(caption);
      row.appendChild(input);
      section.appendChild(row);
    }
    body.appendChild(section);
  }

  const flagsRow = document.createElement('label');
  flagsRow.className = 'bss-toolkit-settings-check';
  const flags = document.createElement('input');
  flags.type = 'checkbox';
  flags.setAttribute('data-bss-settings-flags', '1');
  flagsRow.appendChild(flags);
  flagsRow.appendChild(document.createTextNode(' Color rows by BM flags'));
  body.appendChild(flagsRow);
  panel.appendChild(body);

  const footer = document.createElement('div');
  footer.className = 'bss-toolkit-settings-footer';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'bss-toolkit-btn';
  reset.setAttribute('data-bss-settings-reset', '1');
  reset.textContent = 'Reset colors';
  footer.appendChild(reset);
  panel.appendChild(footer);

  close.addEventListener('click', () => SettingsPanel.close());
  reset.addEventListener('click', () => {
    resetThemeSettings();
    syncInputs(panel);
  });
  flags.addEventListener('change', () => {
    setColorRowsByBmFlags(flags.checked);
  });
  panel.addEventListener('input', (ev) => {
    const t = ev.target;
    if (!(t instanceof HTMLInputElement) || t.type !== 'color') return;
    const key = t.getAttribute('data-bss-theme-key');
    if (key && isThemeKey(key)) setThemeSettings({ [key]: t.value });
  });

  return panel;
}

function buildGear(): HTMLButtonElement {
  const gear = document.createElement('button');
  gear.type = 'button';
  gear.setAttribute(SETTINGS_GEAR_ATTR, '1');
  gear.className = 'bss-toolkit-settings-gear';
  gear.setAttribute('aria-label', 'BM RCON Buddy settings');
  gear.setAttribute('aria-haspopup', 'dialog');
  gear.setAttribute('aria-expanded', 'false');
  gear.setAttribute('title', 'RCON Buddy settings');
  gear.innerHTML = GEAR_SVG;
  gear.addEventListener('click', (ev) => {
    ev.stopPropagation();
    SettingsPanel.toggle();
  });
  return gear;
}

let listenersBound = false;

/**
 * Corner gear + owned popout (not a Battlemetrics modal). Mount once; React
 * recycle cannot steal these nodes because they live on `document.body`.
 */
export const SettingsPanel = {
  mount(): void {
    applyThemeCssVars(getThemeSettings());
    const host = document.body || document.documentElement;
    if (!document.querySelector('[' + SETTINGS_GEAR_ATTR + ']')) {
      host.appendChild(buildGear());
      host.appendChild(buildPanel());
    }
    if (!listenersBound) {
      listenersBound = true;
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') this.close();
      });
      document.addEventListener('click', (ev) => {
        const panel = document.querySelector('[' + SETTINGS_PANEL_ATTR + ']');
        const gear = document.querySelector('[' + SETTINGS_GEAR_ATTR + ']');
        const t = ev.target;
        if (!(t instanceof Node) || !panel || panel.hasAttribute('hidden')) return;
        if (panel.contains(t) || (gear && gear.contains(t))) return;
        this.close();
      });
      registerToolkitMenuCommand('RCON Buddy settings', () => this.open());
    }
    const panel = document.querySelector<HTMLElement>('[' + SETTINGS_PANEL_ATTR + ']');
    if (panel) syncInputs(panel);
  },

  open(): void {
    const panel = document.querySelector<HTMLElement>('[' + SETTINGS_PANEL_ATTR + ']');
    const gear = document.querySelector<HTMLElement>('[' + SETTINGS_GEAR_ATTR + ']');
    if (!panel) return;
    syncInputs(panel);
    panel.removeAttribute('hidden');
    if (gear) gear.setAttribute('aria-expanded', 'true');
  },

  close(): void {
    const panel = document.querySelector<HTMLElement>('[' + SETTINGS_PANEL_ATTR + ']');
    const gear = document.querySelector<HTMLElement>('[' + SETTINGS_GEAR_ATTR + ']');
    if (!panel) return;
    panel.setAttribute('hidden', '');
    if (gear) gear.setAttribute('aria-expanded', 'false');
  },

  toggle(): void {
    const panel = document.querySelector('[' + SETTINGS_PANEL_ATTR + ']');
    if (panel && !panel.hasAttribute('hidden')) this.close();
    else this.open();
  },
};
