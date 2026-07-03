import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import { MATCH_PATTERNS } from './src/server-config';

// Output filename is single-sourced so the @downloadURL/@updateURL can't drift from it.
const USERSCRIPT_FILE = 'bmr-con-buddy.user.js';
const META_FILE = USERSCRIPT_FILE.replace(/\.user\.js$/, '.meta.js');
// Stable "latest release" asset URLs (see .github/workflows/release.yml). Tampermonkey
// polls @updateURL (the small .meta.js) for a version bump, then pulls @downloadURL.
const RELEASE_BASE = 'https://github.com/ethik11/bmrconbuddy/releases/latest/download';

// The userscript banner is generated from this config:
//   - @match      derived from MATCH_PATTERNS (single-sourced via src/server-config.ts)
//   - @grant      auto-detected from GM_* usage in the source (autoGrant, on by default)
//   - @version    auto-filled from package.json (bump the version there, then tag v<version>)
//   - @connect    listed explicitly below — these are NOT auto-detected
export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'BM RCON Buddy',
        namespace: 'https://communitybanlist.com',
        description:
          'Squad RCON toolkit: CBL chips, feed colors, admin-tag name colors, note menu, BM flag rows.',
        author: 'Ethik',
        license: 'MIT',
        match: MATCH_PATTERNS,
        connect: ['communitybanlist.com', 'www.battlemetrics.com', 'api.steampowered.com'],
        downloadURL: `${RELEASE_BASE}/${USERSCRIPT_FILE}`,
        updateURL: `${RELEASE_BASE}/${META_FILE}`,
      },
      build: {
        fileName: USERSCRIPT_FILE,
        metaFileName: true, // emit bmr-con-buddy.meta.js (metadata only) for update checks
      },
    }),
  ],
});
