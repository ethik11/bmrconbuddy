# AGENTS.md

Repo-specific guidance for AI agents and contributors working on **BM RCON Buddy** — a
Tampermonkey userscript for Squad admins on Battlemetrics RCON, built from TypeScript modules
into a single `.user.js` with Vite + vite-plugin-monkey.

## Commands

```bash
pnpm install       # pnpm is required (pinned via packageManager; run `corepack enable` once)
pnpm dev           # Vite dev server + HMR userscript for Tampermonkey
pnpm build         # -> dist/bmr-con-buddy.user.js (+ .meta.js); regenerates the ==UserScript== banner
pnpm test          # Vitest (jsdom)
pnpm typecheck     # tsc for tsconfig.json (browser) AND tsconfig.node.json (config files)
pnpm lint          # ESLint flat config
pnpm format        # Prettier --write
```

Definition of done for any change: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass
(CI runs the same, plus `pnpm run format:check`).

## Architecture

One entry (`src/main.ts`) wires everything; see the module map in [README.md](./README.md). The
dependency graph is a DAG. The keystone is **`src/app/state.ts`** — it sits at the leaf tier
(imports only `constants` + `platform/storage`) and exposes the settings providers and the
Steam-ban singleton accessor, so `feed`/`highlight`/`cbl`/`profile` can read shared state **without
importing `src/app/routing.ts`** (the lifecycle orchestrator). That inversion is what keeps the
apparent `highlight ↔ routing` and `feed ↔ main` cycles from being real. Don't move settings/
singleton accessors into `routing.ts`.

GM APIs (`$` import) appear in exactly four modules: `platform/storage`, `platform/clipboard`,
`cbl/graphql`, `steam/ban-lookup`. Keep pure/DOM logic free of `$` so it stays unit-testable.

## Invariants — do not "clean these up"

These were deliberate in the original and are load-bearing:

- **Behaviour preservation.** This was a 1:1 extraction from a single-file script. Prefer faithful
  ports over cleverness; if you change behaviour, say so and add/adjust a test.
- **`!= null` / `== null` are intentional** (treat `0` and `""` as present) in `cbl/severity`,
  `cbl/graphql` (`mapCblResponse`), and `highlight/rules` (`teamEquals`). Do not let a lint autofix
  rewrite them to `!== undefined` / `??`. Tests pin these.
- **CSS stays a JS string** in `dom/css.ts` — it contains brittle Battlemetrics emotion selectors
  (`css-*`), `!important`, and units like `100vw`/`100pt` a minifier could mangle. Don't move it to
  a `.css` file.
- **All `data-bss-*` attribute names live in `src/constants.ts`.** Never redefine one inline — drift
  causes duplicate DOM injection.
- **`@match` is any RCON server** (`https://www.battlemetrics.com/rcon/servers/*`) plus all player
  profiles. The runtime guard in `src/server-config.ts` is `/rcon/servers/<digits>` so the servers
  index does not start the dashboard. Known-id accents (NL #1 teal, NL #2 gold) live in the same
  module; do not hardcode those ids in routing or CSS.
- **Timing constants** (400/50/300/750/60/350/40/200 ms) and the three separate MutationObservers
  are behaviour — keep them. The `history.pushState/replaceState` patch must run exactly once.
- **`@grant` is autoGrant; `@version` comes from `package.json`.** Never hand-edit the banner — edit
  the source (grants) or `package.json` (version).

## Testing

Vitest with `environment: 'jsdom'`; `vitest.config.ts` aliases `$` → `test/mocks/gm.ts` (in-memory
GM). Explicit imports from `vitest` (no globals). Tiers:

- **Pure** (no DOM/GM): severity math, `mapCblResponse`, `matchesFilter`, `matchPlayer`, note
  templates, copy-info formatting, admin-tag detection, `parseServerIdFromPath` / identity lookup.
- **jsdom fixtures**: `dom/parsing`, `profile/identifiers`, `cbl/chip`, `app/server-identity`.
- **Async services**: `cbl/service` via `vi.useFakeTimers()` + `vi.spyOn(CblGraphqlClient, …)`.

Least-covered area is the observer/timer orchestration in `panels/*` and `profile/scheduler` — add
integration tests there before large changes to them.

## Adding a module

Place it by domain (`dom/`, `feed/`, `players/`, `cbl/`, `steam/`, `panels/`, `profile/`, `app/`).
Keep it below its consumers in the graph; if it needs shared settings or the Steam-ban singleton,
read them from `app/state.ts` rather than importing `app/routing.ts`. Add its `data-*` markers to
`constants.ts`.

## Releasing

Bump `version` in `package.json`, commit, then `git tag v<version> && git push --tags`. The
[release workflow](.github/workflows/release.yml) builds and attaches `bmr-con-buddy.user.js` +
`.meta.js` to a GitHub Release; installed clients auto-update via the banner's `@updateURL`.

## Dependencies

pnpm 11+ with supply-chain hardening in [`pnpm-workspace.yaml`](pnpm-workspace.yaml) (publish
cooldown, install-script allowlist, no-downgrade trust policy). When adding a dep that needs a build
script, add it to `allowBuilds` (else `strictDepBuilds` fails the install). For a CVE, prefer a
targeted `overrides` entry derived from `pnpm audit` on the actual tree.
