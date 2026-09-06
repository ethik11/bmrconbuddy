import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractProfilePlayerCopyInfo,
  formatCopyPlayerInfoBlock,
} from '../../src/profile/copy-info';

const STEAM = '76561190000000001';
const EOS = '0123456789abcdef0123456789abcdef';

describe('formatCopyPlayerInfoBlock', () => {
  it('produces the exact admin-facing block, including the trailing Evidence line', () => {
    expect(
      formatCopyPlayerInfoBlock({
        name: 'Cool',
        steam64: STEAM,
        eos: 'abcdef',
        crime: 'Teamkilling',
        time: 'never',
      }),
    ).toBe(
      'Name: Cool\n' +
        'Steam64: ' +
        STEAM +
        '\n' +
        'EOS: abcdef\n' +
        'Crime: Teamkilling\n' +
        'Time: never\n' +
        'Evidence/Note:\n',
    );
  });

  it('renders empty fields with the label spacing intact', () => {
    expect(formatCopyPlayerInfoBlock({ name: '', steam64: '', eos: '' })).toBe(
      'Name: \nSteam64: \nEOS: \nCrime: \nTime: \nEvidence/Note:\n',
    );
  });
});

describe('extractProfilePlayerCopyInfo', () => {
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

  it('prefers the most recent ban over the note parser', () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<table><tbody>
        <tr>
          <td data-title="Reason">Rule 1: Offensive Language / Hate Speech</td>
          <td data-title="Expires">Perm</td>
        </tr>
      </tbody></table>`,
    );

    expect(extractProfilePlayerCopyInfo()).toEqual({
      name: 'CoolPlayer',
      steam64: STEAM,
      eos: EOS,
      crime: 'Rule 1: Offensive Language / Hate Speech',
      time: 'Perm',
    });
  });

  it('falls back to the note parser when no ban row is present', () => {
    expect(extractProfilePlayerCopyInfo()).toEqual({
      name: 'CoolPlayer',
      steam64: STEAM,
      eos: EOS,
      crime: 'Teamkilling',
      time: 'never',
    });
  });
});
