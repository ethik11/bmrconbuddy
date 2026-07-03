import { describe, it, expect } from 'vitest';
import { formatCopyPlayerInfoBlock } from '../../src/profile/copy-info';

describe('formatCopyPlayerInfoBlock', () => {
  it('produces the exact admin-facing block, including the trailing Evidence line', () => {
    expect(
      formatCopyPlayerInfoBlock({
        name: 'Cool',
        steam64: '76561190000000001',
        eos: 'abcdef',
        crime: 'Teamkilling',
        time: 'never',
      }),
    ).toBe(
      'Name : Cool\n' +
        'Steam64 : 76561190000000001\n' +
        'EOS : abcdef\n' +
        'Crime : Teamkilling\n' +
        'Time : never\n' +
        'Evidence/Note : \n',
    );
  });

  it('renders empty fields with the label spacing intact', () => {
    expect(formatCopyPlayerInfoBlock({ name: '', steam64: '', eos: '' })).toBe(
      'Name : \nSteam64 : \nEOS : \nCrime : \nTime : \nEvidence/Note : \n',
    );
  });
});
