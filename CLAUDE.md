# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Chess Online: a frontend-only web app (React 19 + TypeScript 6, Vite 8) for playing chess online or against a bot, in a "liquid glass" visual style. There is no backend. Project docs and code comments are written in Russian.

- [docs/TZ.md](docs/TZ.md) — the spec (requirements, architecture decisions, routes, a11y/perf targets).
- [docs/ROADMAP.md](docs/ROADMAP.md) — staged plan (0–10) and a **Статус** checklist at the bottom. Stages 0 (scaffold), 1 (design system + themes), 2 (game core: `entities/game`, `clock`, `player`), 3 (pieces + board: `entities/piece`, `widgets/chess-board`, `features/make-move|promote-pawn|flip-board`, `shared/lib/pointer-drag`), 4 (local game end to end: `/local` with clocks, move list/history, resign, draw offers, result modal; `widgets/game-sidebar|game-controls|game-result-modal|app-header`, `features/navigate-history|resign-game|offer-draw`, `pages/home`) and 5 (protocol, host, transports: `shared/api`, `features/host-game`, `features/game-client`; `/local` runs through host + client over `LocalTransport`) are done; online between tabs, bot and session are not yet implemented. Check the roadmap before assuming a module exists (`entities/session|bot`, other `features/` and `widgets/` are not created yet).

## Commands

```bash
npm run dev            # vite dev server
npm test               # vitest run (all tests)
npm run test:watch
npx vitest run src/shared/lib/theme/theme.test.ts   # single test file
npx vitest run -t "name"                            # single test by name
npm run test:coverage
npm run lint           # oxlint
npm run lint:fsd       # steiger ./src — enforces Feature-Sliced Design layer/slice rules
npm run typecheck      # tsc -b
npm run format         # prettier --write . (format:check in CI)
npm run build          # tsc -b && vite build
```

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs, in order: `format:check`, `lint`, `lint:fsd`, `typecheck`, `test`, `build`. All must pass. Prettier: no semicolons, single quotes, trailing commas, width 100.

## Architecture

**Feature-Sliced Design.** Layers under `src/`, importing only downward: `app` → `pages` → `widgets` → `features` → `entities` → `shared`. Each slice exposes a public API via `index.ts`; import from the slice root, not its internals. Use the `@/` alias for `src/`. `npm run lint:fsd` (Steiger) checks this; `fsd/insignificant-slice` is intentionally off in [steiger.config.ts](steiger.config.ts) while slices are still stubs.

**Architecture from the spec** (game rules, transport and host exist; bot and session are not built yet) — keep new code consistent with it:

- Game rules are delegated to `chess.js`, wrapped behind an interface in `entities/game`; state via Zustand; styling via CSS Modules.
- All play (including local hot-seat and bot) goes through `shared/api`: the client side `GameTransport` and the server side `HostTransport` (`LocalTransport` — synchronous in-memory room, `BroadcastChannelTransport`, later `WebSocketTransport`), with Zod-validated protocol messages (`shared/api/protocol.ts` is the single source of truth). Authoritative game logic lives in `features/host-game`, not in transports; UI talks to the host only through `features/game-client` (a replica of the game + clocks in stores). Pages compose them (see `pages/local-game/model/createLocalGame`).
- The bot is an ordinary player speaking the same protocol; the engine (Stockfish in a Web Worker) sits behind a `ChessEngine` interface.
- Identity comes only from `entities/session` / `AuthService` (guest-only in MVP); nothing else reads `localStorage` for it.

**Routing** ([src/app/router.tsx](src/app/router.tsx)): `createBrowserRouter`; paths live in `ROUTES` ([src/shared/config/routes.ts](src/shared/config/routes.ts)). Heavy pages are lazy-loaded via the `lazy` route option (e.g. `/kit`).

**Theming.** Colour tokens live in [src/app/styles/](src/app/styles/) (`tokens.css`, `themes.css`, `fallbacks.css`); the theme is the `data-theme` attribute on `:root`. Theme state is a small external store in [src/shared/lib/theme/theme.ts](src/shared/lib/theme/theme.ts) (modes `system | light | dark`, persisted under `chess:theme`). The inline script in [index.html](index.html) duplicates the resolve logic and storage key to set the theme before first render — **change both places together**.

**Glass UI kit** (`src/shared/ui/Glass*`) is built on the shared `.surface` class in [glass.module.css](src/shared/ui/glass.module.css) (backdrop blur + fill + border + highlight). `/kit` ([src/pages/kit](src/pages/kit)) is a showcase page for iterating on glass in both themes. Fallbacks for `@supports`, `prefers-reduced-*` are in `fallbacks.css`.

## Gotchas

- `vite.config.ts` sets `build.cssTarget` to include `safari16` deliberately: without it the minifier strips `-webkit-backdrop-filter` and glass disappears in Safari < 18. Keep the `-webkit-` prefixes in CSS.
- jsdom lacks `<dialog>.showModal/close`; [vitest.setup.ts](vitest.setup.ts) polyfills them. Vitest runs with `globals: true` and CSS modules use `non-scoped` class names, so tests can query by plain class name.
- TypeScript is very strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly` — no enums/namespaces/parameter properties, `verbatimModuleSyntax` — use `import type`).
- Tests are colocated with sources (`*.test.ts(x)`). Steiger also forbids cross-slice imports inside test files, so tests that need two features at once (e.g. host + client) live in `app/` (`src/app/gameFlow.test.ts`).
