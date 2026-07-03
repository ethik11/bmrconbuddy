import { describe, it, expect } from 'vitest';
import { matchesFilter } from '../../src/players/filter';

describe('matchesFilter', () => {
  it('matches everything when the filter is empty or whitespace', () => {
    expect(matchesFilter('anything', '')).toBe(true);
    expect(matchesFilter('anything', '   ')).toBe(true);
  });

  it('does case-insensitive substring matching by default', () => {
    expect(matchesFilter('Hello World', 'world')).toBe(true);
    expect(matchesFilter('Hello World', 'WORLD')).toBe(true);
    expect(matchesFilter('abc', 'xyz')).toBe(false);
  });

  it('treats /pattern/flags as a regex', () => {
    expect(matchesFilter('SquadLeader', '/lead/')).toBe(true);
    expect(matchesFilter('SquadLeader', '/^squad/')).toBe(true);
    expect(matchesFilter('SquadLeader', '/nope/')).toBe(false);
  });

  it('honors explicit regex flags', () => {
    // Default flag is 'i'; the haystack is lowercased, so matching is case-insensitive.
    expect(matchesFilter('SquadLeader', '/LEADER/')).toBe(true);
  });

  it('falls back to substring when the regex is invalid', () => {
    // "/[/" -> pattern "[" is an invalid regex; fall back to literal substring search.
    expect(matchesFilter('weird/[/name', '/[/')).toBe(true);
    expect(matchesFilter('plain', '/[/')).toBe(false);
  });

  it('does not treat a filter without a closing slash as regex', () => {
    // lastIndexOf('/') must be > 0; "/x" has it at index 0 -> substring branch.
    expect(matchesFilter('a/x b', '/x')).toBe(true);
    expect(matchesFilter('nope', '/x')).toBe(false);
  });
});
