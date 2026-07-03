/**
 * Shared filter matcher for the player list and the live feed.
 *
 * This is the single source for the "`/regex/flags` else case-insensitive
 * substring" logic that was previously copy-pasted into ConnectedPlayersPanel
 * and RconLiveFeed. An empty/whitespace filter matches everything (no filtering).
 */
export function matchesFilter(haystack: string, filter: string): boolean {
  const f = (filter || '').trim();
  if (!f) return true;

  const hay = haystack.toLowerCase();
  if (f.length >= 2 && f[0] === '/' && f.lastIndexOf('/') > 0) {
    try {
      const re = new RegExp(f.slice(1, f.lastIndexOf('/')), f.slice(f.lastIndexOf('/') + 1) || 'i');
      return re.test(hay);
    } catch {
      return hay.indexOf(f.toLowerCase()) !== -1;
    }
  }
  return hay.indexOf(f.toLowerCase()) !== -1;
}
