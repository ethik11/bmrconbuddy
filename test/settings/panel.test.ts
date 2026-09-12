import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SETTINGS_GEAR_ATTR, SETTINGS_PANEL_ATTR } from '../../src/constants';
import { getThemeSettings } from '../../src/app/state';
import { DEFAULT_THEME } from '../../src/settings/defaults';
import { SettingsPanel } from '../../src/settings/panel';
import { __resetGmStore } from '../mocks/gm';

describe('SettingsPanel', () => {
  beforeEach(() => {
    __resetGmStore();
    document.body.innerHTML = '';
    SettingsPanel.mount();
  });

  afterEach(() => {
    SettingsPanel.close();
    document.body.innerHTML = '';
    __resetGmStore();
  });

  it('mounts a closed gear + panel on the body', () => {
    const gear = document.querySelector('[' + SETTINGS_GEAR_ATTR + ']');
    const panel = document.querySelector('[' + SETTINGS_PANEL_ATTR + ']');
    expect(gear).toBeTruthy();
    expect(panel).toBeTruthy();
    expect(panel?.hasAttribute('hidden')).toBe(true);
    expect(gear?.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens and closes from the gear, Escape, and a click outside', () => {
    const gear = document.querySelector<HTMLElement>('[' + SETTINGS_GEAR_ATTR + ']')!;
    const panel = document.querySelector<HTMLElement>('[' + SETTINGS_PANEL_ATTR + ']')!;
    gear.click();
    expect(panel.hasAttribute('hidden')).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel.hasAttribute('hidden')).toBe(true);

    SettingsPanel.open();
    document.body.click();
    expect(panel.hasAttribute('hidden')).toBe(true);
  });

  it('persists a color change and reset restores defaults', () => {
    SettingsPanel.open();
    const panel = document.querySelector<HTMLElement>('[' + SETTINGS_PANEL_ATTR + ']')!;
    const input = panel.querySelector<HTMLInputElement>(
      'input[data-bss-theme-key="feedModAction"]',
    )!;
    input.value = '#112233';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(getThemeSettings().feedModAction).toBe('#112233');

    panel.querySelector<HTMLButtonElement>('[data-bss-settings-reset]')!.click();
    expect(getThemeSettings()).toEqual(DEFAULT_THEME);
    expect(input.value).toBe(DEFAULT_THEME.feedModAction);
  });

  it('does not duplicate the gear when mount is called again', () => {
    SettingsPanel.mount();
    expect(document.querySelectorAll('[' + SETTINGS_GEAR_ATTR + ']')).toHaveLength(1);
  });
});
