import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractSteamId64FromProfileIdentifiers,
  extractEosIdFromProfile,
  extractProfilePlayerName,
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
