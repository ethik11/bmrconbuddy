import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractSteamId64FromProfileIdentifiers,
  extractEosIdFromProfile,
  extractProfilePlayerName,
  extractProfileBanCrimeTime,
  extractProfileNoteCrimeTime,
} from '../../src/profile/identifiers';

const STEAM = '76561190000000001';
const EOS = '0123456789abcdef0123456789abcdef';

beforeEach(() => {
  document.body.innerHTML = `
    <table><tbody>
      <tr><td data-title="Type">Steam ID</td>
          <td data-title="Identifier"><span title="${STEAM}">hidden</span></td></tr>
      <tr><td data-title="Type">EOS ID</td>
          <td data-title="Identifier">${EOS}</td></tr>
      <tr><td data-title="Type">Name</td>
          <td data-title="Identifier">CoolPlayer</td></tr>
    </tbody></table>
    <div class="collapse in"><ul><li><a><span>2026 - Teamkilling | Expires: never</span></a></li></ul></div>`;
});

describe('profile identifier scrapers', () => {
  it('extracts the SteamID64 from the identifiers table', () => {
    expect(extractSteamId64FromProfileIdentifiers()).toBe(STEAM);
  });

  it('extracts the EOS id', () => {
    expect(extractEosIdFromProfile()).toBe(EOS);
  });

  it('extracts the player name', () => {
    expect(extractProfilePlayerName()).toBe('CoolPlayer');
  });

  it('parses crime and expiry from the active note', () => {
    expect(extractProfileNoteCrimeTime()).toEqual({ crime: 'Teamkilling', time: 'never' });
  });

  it('returns empty crime/time when no note is present', () => {
    document.body.innerHTML = '';
    expect(extractProfileNoteCrimeTime()).toEqual({ crime: '', time: '' });
  });
});

describe('extractProfileBanCrimeTime', () => {
  it('reads crime and time from the first (most recent) ban row', () => {
    document.body.innerHTML = `
      <table><tbody>
        <tr>
          <td data-title="Reason">Rule 1: Offensive Language / Hate Speech</td>
          <td data-title="Expires">Perm</td>
        </tr>
        <tr>
          <td data-title="Reason">Older ban</td>
          <td data-title="Expires">2025-01-01</td>
        </tr>
      </tbody></table>`;
    expect(extractProfileBanCrimeTime()).toEqual({
      crime: 'Rule 1: Offensive Language / Hate Speech',
      time: 'Perm',
    });
  });

  it('normalizes Permanent, Never, and empty expiry to Perm', () => {
    document.body.innerHTML = `
      <table><tbody>
        <tr>
          <td data-title="Reason">Teamkilling</td>
          <td data-title="Expires">Permanent</td>
        </tr>
      </tbody></table>`;
    expect(extractProfileBanCrimeTime()).toEqual({ crime: 'Teamkilling', time: 'Perm' });

    document.body.innerHTML = `
      <table><tbody>
        <tr>
          <td data-title="Reason">Teamkilling</td>
          <td data-title="Expiry">Never</td>
        </tr>
      </tbody></table>`;
    expect(extractProfileBanCrimeTime()).toEqual({ crime: 'Teamkilling', time: 'Perm' });

    document.body.innerHTML = `
      <table><tbody>
        <tr>
          <td data-title="Reason">Teamkilling</td>
          <td data-title="Expiration"></td>
        </tr>
      </tbody></table>`;
    expect(extractProfileBanCrimeTime()).toEqual({ crime: 'Teamkilling', time: 'Perm' });
  });

  it('keeps a timed expiry as displayed', () => {
    document.body.innerHTML = `
      <table><tbody>
        <tr>
          <td data-title="Reason">Seeding Rules</td>
          <td data-title="Expires">in 3 days</td>
        </tr>
      </tbody></table>`;
    expect(extractProfileBanCrimeTime()).toEqual({ crime: 'Seeding Rules', time: 'in 3 days' });
  });

  it('prefers a title attribute when the reason cell text is truncated', () => {
    document.body.innerHTML = `
      <table><tbody>
        <tr>
          <td data-title="Reason"><span title="Rule 1: Offensive Language / Hate Speech">Rule 1…</span></td>
          <td data-title="Expires">Perm</td>
        </tr>
      </tbody></table>`;
    expect(extractProfileBanCrimeTime()).toEqual({
      crime: 'Rule 1: Offensive Language / Hate Speech',
      time: 'Perm',
    });
  });

  it('returns empty crime/time when no ban row is present', () => {
    document.body.innerHTML = '';
    expect(extractProfileBanCrimeTime()).toEqual({ crime: '', time: '' });
  });
});
