import { describe, it, expect } from 'vitest';
import {
  isAdminBadgeTitle,
  badgeTitlesIncludeAdminTag,
  scopeHasAdminTag,
} from '../../src/players/admin-tag';

describe('isAdminBadgeTitle', () => {
  it('is true for admin flags', () => {
    expect(isAdminBadgeTitle('NL Squad Admin')).toBe(true);
    expect(isAdminBadgeTitle('ADMIN')).toBe(true);
    expect(isAdminBadgeTitle('admin')).toBe(true);
  });

  it('is false for "Regular Player" even when it contains "admin" elsewhere', () => {
    expect(isAdminBadgeTitle('Regular Player')).toBe(false);
    expect(isAdminBadgeTitle('Admin - Regular Player')).toBe(false);
  });

  it('is false for non-admin / empty titles', () => {
    expect(isAdminBadgeTitle('Moderator')).toBe(false);
    expect(isAdminBadgeTitle('')).toBe(false);
    expect(isAdminBadgeTitle(null)).toBe(false);
  });
});

describe('badgeTitlesIncludeAdminTag', () => {
  it('detects any admin title in the list', () => {
    expect(badgeTitlesIncludeAdminTag(['Sus', 'NL Squad Admin'])).toBe(true);
    expect(badgeTitlesIncludeAdminTag(['Sus', 'VIP'])).toBe(false);
    expect(badgeTitlesIncludeAdminTag([])).toBe(false);
  });
});

describe('scopeHasAdminTag (jsdom)', () => {
  it('finds an admin flag via span[title]', () => {
    document.body.innerHTML = '<div id="s"><span title="NL Squad Admin"></span></div>';
    expect(scopeHasAdminTag(document.getElementById('s'))).toBe(true);
  });

  it('finds an admin flag via a div.name badge', () => {
    document.body.innerHTML =
      '<div id="s"><div class="name"><svg title="Squad Admin"></svg></div></div>';
    expect(scopeHasAdminTag(document.getElementById('s'))).toBe(true);
  });

  it('is false when only non-admin flags are present', () => {
    document.body.innerHTML = '<div id="s"><span title="Sus"></span></div>';
    expect(scopeHasAdminTag(document.getElementById('s'))).toBe(false);
  });
});
