import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getThemeSettings, resetThemeSettings, setThemeSettings } from '../../src/app/state';
import {
  applyThemeCssVars,
  DEFAULT_THEME,
  mergeTheme,
  normalizeHex,
  THEME_CSS_VARS,
} from '../../src/settings/defaults';
import { __resetGmStore } from '../mocks/gm';

describe('normalizeHex', () => {
  it('lowercases 6-digit hex', () => {
    expect(normalizeHex('#FF3333')).toBe('#ff3333');
  });

  it('expands 3-digit hex', () => {
    expect(normalizeHex('#abc')).toBe('#aabbcc');
  });

  it('rejects non-hex', () => {
    expect(normalizeHex('red')).toBeNull();
    expect(normalizeHex('#ffff')).toBeNull();
    expect(normalizeHex(12)).toBeNull();
  });
});

describe('mergeTheme', () => {
  it('returns defaults for empty / invalid stored values', () => {
    expect(mergeTheme(null)).toEqual(DEFAULT_THEME);
    expect(mergeTheme('nope')).toEqual(DEFAULT_THEME);
    expect(mergeTheme([])).toEqual(DEFAULT_THEME);
  });

  it('overlays valid keys and ignores unknown or invalid ones', () => {
    const merged = mergeTheme({
      feedModAction: '#ABC',
      unknown: '#ffffff',
      feedAdminAction: 'green',
    });
    expect(merged.feedModAction).toBe('#aabbcc');
    expect(merged.feedAdminAction).toBe(DEFAULT_THEME.feedAdminAction);
    expect(merged.highlightKick).toBe(DEFAULT_THEME.highlightKick);
  });
});

describe('applyThemeCssVars', () => {
  it('writes CSS variables onto the given root', () => {
    const root = document.createElement('div');
    applyThemeCssVars(DEFAULT_THEME, root);
    expect(root.style.getPropertyValue(THEME_CSS_VARS.feedModAction)).toBe(
      DEFAULT_THEME.feedModAction,
    );
    expect(root.style.getPropertyValue(THEME_CSS_VARS.adminTagName)).toBe(
      DEFAULT_THEME.adminTagName,
    );
  });
});

describe('theme settings storage', () => {
  beforeEach(() => __resetGmStore());
  afterEach(() => __resetGmStore());

  it('starts at defaults and persists a partial overlay', () => {
    expect(getThemeSettings()).toEqual(DEFAULT_THEME);
    setThemeSettings({ feedModAction: '#112233' });
    expect(getThemeSettings().feedModAction).toBe('#112233');
    expect(getThemeSettings().feedAdminAction).toBe(DEFAULT_THEME.feedAdminAction);
  });

  it('reset restores defaults', () => {
    setThemeSettings({ highlightKick: '#000000' });
    expect(resetThemeSettings()).toEqual(DEFAULT_THEME);
    expect(getThemeSettings()).toEqual(DEFAULT_THEME);
  });
});
