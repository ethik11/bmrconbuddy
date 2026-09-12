# BM RCON Buddy

A [Tampermonkey](https://www.tampermonkey.net/) userscript for Squad server admins on the
[Battlemetrics](https://www.battlemetrics.com/) RCON dashboard. It adds Community Ban List (CBL)
reputation chips, colored feed lines, admin-tag name colors, player/feed filters, BM-flag row
tints, and a profile-page "Copy Player Info" + note-template menu.

> **Version 1.8.0** · MIT · any Battlemetrics RCON server dashboard plus all player profile pages.

The script is written as small TypeScript modules and bundled into a single `.user.js` with
[Vite](https://vitejs.dev/) + [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey).
Installing it is still just "add one file to Tampermonkey" — the module split is source-only.

## Features

| Area                | What it does                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CBL chips**       | Gradient reputation chip (severity-colored) next to each player, and in the profile header. Cached with a TTL; queued + rate-limited against the CBL GraphQL API.                           |
| **Feed colors**     | Phrase-based coloring of the live RCON feed and the profile activity log (mod actions, admin actions, team names, team kills, known auto-kick spam). Local-timezone tooltips on timestamps. |
| **Admin-tag names** | Cyan player name when a BM admin badge/tag is present (list + profile header).                                                                                                              |
| **Row tints**       | Left-border tint per player row: admin (pink) → Problem Player (red) → sus (orange) → VAC/game ban (red, needs a Steam Web API key).                                                        |
| **Filters**         | Substring or `/regex/flags` filtering of both the player list and the feed.                                                                                                                 |
| **Highlight rules** | Built-in feed border rules (warn/trigger/kick) plus stored, user-configurable player/feed rules.                                                                                            |
| **Profile actions** | On the Overview tab: "Copy Player Info" (name/Steam64/EOS, Crime/Time from the latest ban) and a Warn/Kick "Note Menu" that fills the note editor.                                          |
| **Server identity** | 4px left accent bar on every dashboard (teal NL #1, gold NL #2, slate otherwise) plus a named header pill on the two Northern Lights servers. Feed colors stay the same everywhere.         |

**Supported pages** (`@match`):

- `https://www.battlemetrics.com/rcon/servers/*` — connected players + live feed on any RCON server
- `https://www.battlemetrics.com/rcon/players/*` — player profile pages

## Install (users)

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension.
2. Open the latest release build —
   **[bmr-con-buddy.user.js](https://github.com/ethik11/bmrconbuddy/releases/latest/download/bmr-con-buddy.user.js)** —
   and Tampermonkey will prompt to install. It **auto-updates** from GitHub Releases thereafter (via
   `@updateURL`).

Prefer to build it yourself? `pnpm install && pnpm build`, then open `dist/bmr-con-buddy.user.js`
(see [Development](#development)).

Known dashboard accents (teal / gold) are listed in [`src/server-config.ts`](src/server-config.ts).
Any other numeric `/rcon/servers/<id>` still gets the toolkit, with a slate left bar and no named
pill.

## Development

Requires [Node](https://nodejs.org/) 20+ and [pnpm](https://pnpm.io/) (pinned via `packageManager`;
run `corepack enable` once if `pnpm` isn't on your PATH).

```bash
pnpm install       # install dependencies (see Supply-chain notes below)
pnpm dev           # Vite dev server with HMR; opens the *.user.js for Tampermonkey
pnpm build         # bundle -> dist/bmr-con-buddy.user.js (generates the ==UserScript== banner)
pnpm test          # Vitest (jsdom) unit + DOM tests
pnpm typecheck     # tsc --noEmit for both the browser and the config tsconfig
pnpm lint          # ESLint (flat config)
pnpm format        # Prettier --write
```

The `@grant` list is auto-detected from GM\_\* usage and `@version` is taken from `package.json`, so
the banner never drifts from the code — bump the version in `package.json` only.

### Project structure

```
src/
  main.ts                 # entry point (the only module with top-level side effects)
  server-config.ts        # @match patterns + route regex + known-server accents
  constants.ts            # storage prefix, all data-bss-* markers, id regexes, default rules
  types.ts                # shared interfaces (ParsedPlayerRow, HighlightRule, CblPayload, …)
  app/
    state.ts              # settings providers + shared-singleton accessors (keystone; leaf tier)
    routing.ts            # SPA route switch, dashboard lifecycle, history.pushState watcher
    server-identity.ts    # per-server left-bar + NL pill chrome
    self-check.ts         # warns (once, after settle) when expected DOM hooks are missing
  platform/
    storage.ts            # GM_getValue/GM_setValue wrappers
    clipboard.ts          # GM_setClipboard + fallbacks
  dom/
    parsing.ts            # normalize text, parse player rows, detect feed-line structure
    css.ts                # the injected <style> block (kept as a JS string on purpose)
  feed/
    colors.ts             # feed phrase -> color tables + engine
    enhancer.ts           # timestamp tooltips, modal colors, shared reconcile pass
  players/
    admin-tag.ts          # admin-badge detection + cyan name styler
    flag-styler.ts        # row-tint priority (admin/problem/sus/steam-ban)
    filter.ts             # matchesFilter() — shared substring / regex matcher
  highlight/
    rules.ts              # player + feed highlight-rule engine
  cbl/
    graphql.ts            # CBL GraphQL client + response mapper
    severity.ts           # chip severity math (pure)
    service.ts            # cache + TTL + rate-limited queue, profile-page singleton
    chip.ts               # build/mount the reputation chip
  steam/
    ban-lookup.ts         # optional VAC/game-ban lookup (Steam Web API)
  panels/
    connected-players.ts  # player list observer + reconcile
    live-feed.ts          # live feed observer + reconcile
  profile/
    scheduler.ts          # profile-page task runner (observer + interval)
    identifiers.ts        # profile DOM scrapers (h1, tabs, Steam64/EOS/name/ban/note)
    copy-info.ts          # Copy Player Info block
    note-templates.ts     # Warn/Kick note templates + editor fill
    header-cbl.ts         # profile-header CBL chip
    overview-ui.ts        # Copy button + Note Menu UI
test/                     # Vitest specs + jsdom fixtures + the GM mock ($ alias)
```

The dependency graph is acyclic: `app/state.ts` sits at the leaf tier so `feed`/`highlight`/`cbl`/
`profile` can read shared settings and the Steam-ban singleton without importing the lifecycle
orchestrator in `app/routing.ts`.

### Settings & storage

All persisted values use the `bssToolkit.v1.` prefix in GM storage:

| Key                                             | Purpose                                                     |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `highlightRules`                                | user-configurable highlight rules (falls back to built-ins) |
| `playerFilter` / `feedFilter`                   | active filter strings                                       |
| `colorRowsByBmFlags`                            | toggle BM-flag row tints                                    |
| `cblCache` / `cblTtlHours` / `cblMinIntervalMs` | CBL reputation cache + tuning                               |
| `steamBanCache` / `steamWebApiKey`              | Steam ban cache; the optional Steam Web API key             |

### Supply-chain notes

Dependencies are hardened in [`pnpm-workspace.yaml`](pnpm-workspace.yaml): a publish-age cooldown
(`minimumReleaseAge`), an install-script allowlist (`allowBuilds` + `strictDepBuilds`), blocked
exotic sub-deps, and a no-downgrade trust policy. This needs pnpm 11+ (pinned via `packageManager`).

## Contributing

Conventional Commits (`feat:`, `fix(scope):`, `chore:`, …). Run `pnpm typecheck && pnpm lint && pnpm test`
before pushing (CI runs the same, plus `pnpm build`).

## License

MIT © ethik11 (Ethik). See [LICENSE](LICENSE).
