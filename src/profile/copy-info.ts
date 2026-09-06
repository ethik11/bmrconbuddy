import {
  extractEosIdFromProfile,
  extractProfileBanCrimeTime,
  extractProfileNoteCrimeTime,
  extractProfilePlayerName,
  extractSteamId64FromProfileIdentifiers,
} from './identifiers';

export interface ProfileCopyInfo {
  name: string;
  steam64: string;
  eos: string;
  crime: string;
  time: string;
}

export function extractProfilePlayerCopyInfo(): ProfileCopyInfo {
  const ban = extractProfileBanCrimeTime();
  const notes = ban.crime || ban.time ? ban : extractProfileNoteCrimeTime();
  return {
    name: extractProfilePlayerName(),
    steam64: extractSteamId64FromProfileIdentifiers() || '',
    eos: extractEosIdFromProfile(),
    crime: notes.crime,
    time: notes.time,
  };
}

/** Format the "Copy Player Info" clipboard block (exact layout is relied upon by admins). */
export function formatCopyPlayerInfoBlock(info: {
  name: string;
  steam64: string;
  eos: string;
  crime?: string;
  time?: string;
}): string {
  return (
    'Name: ' +
    (info.name || '') +
    '\n' +
    'Steam64: ' +
    (info.steam64 || '') +
    '\n' +
    'EOS: ' +
    (info.eos || '') +
    '\n' +
    'Crime: ' +
    (info.crime || '') +
    '\n' +
    'Time: ' +
    (info.time || '') +
    '\n' +
    'Evidence/Note:\n'
  );
}
