import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SERVER_ACCENT,
  KNOWN_SERVERS,
  MATCH_PATTERNS,
  MATCHED_SERVER_PATH_RE,
  lookupServerIdentity,
  parseServerIdFromPath,
} from '../../src/server-config';

describe('MATCH_PATTERNS', () => {
  it('matches every RCON server dashboard and all player profiles', () => {
    expect(MATCH_PATTERNS).toEqual([
      'https://www.battlemetrics.com/rcon/servers/*',
      'https://www.battlemetrics.com/rcon/players/*',
    ]);
  });
});

describe('MATCHED_SERVER_PATH_RE', () => {
  it('matches numeric server dashboards and not the servers index', () => {
    expect(MATCHED_SERVER_PATH_RE.test('/rcon/servers/34935347')).toBe(true);
    expect(MATCHED_SERVER_PATH_RE.test('/rcon/servers/40375266')).toBe(true);
    expect(MATCHED_SERVER_PATH_RE.test('/rcon/servers/1')).toBe(true);
    expect(MATCHED_SERVER_PATH_RE.test('/rcon/servers')).toBe(false);
    expect(MATCHED_SERVER_PATH_RE.test('/rcon/servers/')).toBe(false);
    expect(MATCHED_SERVER_PATH_RE.test('/rcon/players/123')).toBe(false);
  });
});

describe('parseServerIdFromPath', () => {
  it('extracts the numeric id from a dashboard path', () => {
    expect(parseServerIdFromPath('/rcon/servers/34935347')).toBe('34935347');
    expect(parseServerIdFromPath('/rcon/servers/40375266/console')).toBe('40375266');
  });

  it('returns null when the path is not a numeric server dashboard', () => {
    expect(parseServerIdFromPath('/rcon/servers')).toBeNull();
    expect(parseServerIdFromPath('/rcon/players/123')).toBeNull();
    expect(parseServerIdFromPath('/')).toBeNull();
  });
});

describe('lookupServerIdentity', () => {
  it('returns named teal/gold looks for the Northern Lights servers', () => {
    expect(lookupServerIdentity('34935347')).toEqual({ label: 'NL #1', accent: '#2dd4bf' });
    expect(lookupServerIdentity('40375266')).toEqual({ label: 'NL #2', accent: '#fbbf24' });
    expect(KNOWN_SERVERS['34935347'].label).toBe('NL #1');
    expect(KNOWN_SERVERS['40375266'].label).toBe('NL #2');
  });

  it('returns a slate bar-only look for unknown ids', () => {
    expect(lookupServerIdentity('999')).toEqual({ label: null, accent: DEFAULT_SERVER_ACCENT });
  });
});
