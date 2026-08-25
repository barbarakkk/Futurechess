# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Setup

```bash
npm install
npm install --prefix server
npm install --prefix client
cd server && npx prisma generate && npx prisma migrate dev
```

Copy `server/.env.example` → `server/.env` and `client/.env.example` → `client/.env` first.

### Development

```bash
npm run dev   # from repo root — runs client (:5173) + server (:4000) concurrently via `concurrently`
```

Or separately: `npm run dev --prefix client` / `npm run dev --prefix server`.

### Build

```bash
cd client && npm run build   # tsc && vite build -> client/dist
cd server && npm run start   # node src/index.js (production)
```

Root `npm run build` is what Railway runs for the server workspace only (`prisma generate` + `prisma migrate deploy`) — it does not build the client.

### Type checking

```bash
cd client && npx tsc --noEmit
```

Server is plain CommonJS JavaScript (`require`/`module.exports`), no type checking.

### Database (run from `server/`)

```bash
npx prisma generate
npx prisma migrate dev       # local dev — creates/applies a migration
npx prisma migrate deploy    # production
npx prisma migrate status    # verify DB connectivity
```

### Tests

No test suite exists yet — `npm test` in root/client/server is a stub that exits with an error. Verification is manual; see the Smoke Test Checklist in `README.md`.

## Architecture

npm-workspaces monorepo (`client`, `server`); root `package.json` only orchestrates both.

### Client — React 19 + Vite + TypeScript (`client/src/`)

- `pages/` — one file per route screen: `LandingPage`, `LoginPage`, `RegisterPage`, `DashboardPage`, `NewGamePage`, `FriendGamePage`, `AiGamePage`, `GameHistoryPage`, `SettingsPage`.
- `components/AppShell.tsx` — sidebar/nav shell wrapping all protected routes. `ProtectedRoute.tsx` redirects to `/login` when there's no auth token. `components/ui/` — button/card/badge/input primitives built on `class-variance-authority` + Tailwind.
- `store/authStore.ts` — Zustand store with `persist` middleware; holds JWT + user, persisted to localStorage under the key `futurechess-auth` (legacy name — see naming note below).
- `lib/api.ts` — shared axios instance that auto-attaches `Authorization: Bearer <token>` from `authStore`. `lib/errors.ts` normalizes API error responses for display.
- `i18n/index.ts` + `locales/{en,ka}/*.json` — react-i18next setup; English and Georgian, one namespace per page (`useTranslation("<namespace>")`). Never hardcode user-facing JSX strings — add a key to both locale files instead. Never wrap functional/data values in `t()` — time control names, difficulty/color values, socket event/field names, and chess result notation (`1-0`, `0-1`, `1/2-1/2`) must stay as the literal English values the server expects; only the display label is translated. Backend-originated error messages (API/socket error responses) are intentionally left untranslated.
- Routing lives in `App.tsx`: public routes (`/`, `/login`, `/register`) vs. protected routes nested under `ProtectedRoute` + `AppShell`.

### Server — Express 5 + Socket.io + Prisma, CommonJS (`server/src/`)

- `app.js` — Express app: CORS, JSON body parsing, mounts `/auth`, `/games`, `/ai-games` routers, centralized error middleware (Zod validation errors → `400` with `VALIDATION_ERROR` + `issues`; otherwise uses `err.statusCode`/`err.code`).
- `index.js` — HTTP server entrypoint; attaches Socket.io to the same server.
- `routes/` — HTTP routers (auth, friend games, AI games).
- `realtime/socketHub.js` — Socket.io auth (JWT via handshake `auth.token`) and event handlers: `game:join`, `game:move`, `game:resign`, `game:draw-offer`, `game:draw-response` (friend games only; AI games are HTTP-only).
- `realtime/gameRuntime.js` — the core game engine: an in-memory `Map` of live game runtimes (a chess.js instance + server-tracked clocks per game), move validation/application, checkmate/draw/timeout detection, and persistence to Postgres via Prisma. This module is server-authoritative — the client board is just a view. Time controls (source of truth): Bullet 1min, Blitz 5min, Rapid 10min, Classical 30min, Freestyle no clock — some UI copy may state different figures, the server values here win.
- `services/stockfishService.js` — spawns the `stockfish` npm package as a child process, talks UCI (`position fen ...` / `go depth N`). Depth per difficulty: easy=6, medium=10, hard=14; 8s timeout.
- `middleware/auth.js` — JWT bearer auth for HTTP routes.
- `utils/` — `jwt.js` (sign/verify, 7-day expiry), `inviteCode.js` (`FC-XXXX` generator), `createHttpError.js`.
- `prisma/schema.prisma` — models: `User`, `Game` (friend games), `AIGame`, `UserHiddenGame` (soft-delete join table so a user can hide a game from their own history without affecting the opponent's view).

### Key design points

- **Friend games are realtime + server-authoritative**: moves/clocks/resign/draw all go through Socket.io; chess.js validates every move server-side regardless of what the client UI allowed.
- **AI games are HTTP-only** request/response (create → move → Stockfish reply); no sockets involved.
- **Live friend-game clocks live in server memory** (the `Map` in `gameRuntime.js`) — a server restart mid-game resets runtime clock state, though the DB still has persisted moves/result once a game ends.
- **Soft-delete for history**: `DELETE /games/:id` does not remove the row — it inserts into `user_hidden_games` so the game only disappears from that one user's list.
- Supabase Postgres has RLS enabled and PostgREST access revoked on public tables (see the `harden_public_schema_rls` / `rls_policies_and_fk_indexes` migrations) — the app connects with its own credentials via Prisma, not through PostgREST.
- Client is TypeScript; server is CommonJS JavaScript — don't mix module syntax across the boundary.
- Product naming is inconsistent in a few places: UI says "ChessHub" but some internal identifiers still say "FutureChess" (the localStorage key `futurechess-auth`, the server's root route message). This is known and not something to "fix" incidentally while working on unrelated tasks.

### Environment variables

- `server/.env`: `PORT` (default 4000), `JWT_SECRET`, `DATABASE_URL` (pooled Supabase connection, used at runtime), `DIRECT_URL` (direct Supabase connection, used for migrations — Prisma falls back to `DATABASE_URL` if omitted, see `server/prisma.config.ts`).
- `client/.env`: `VITE_API_URL` (backend base URL, defaults to `http://localhost:4000`).

### Deployment

- Client → Vercel (root directory `client`, build `npm run build`, output `dist`).
- Server → Railway (root directory `server`, start `npm run start`, needs `PORT`/`JWT_SECRET`/`DATABASE_URL`/`DIRECT_URL`, run `npx prisma migrate deploy` on deploy). `npm run railway:push-env` (root) pushes local env vars to Railway via `server/scripts/push-env-to-railway.js`.
- Database → Supabase Postgres.

### PRD workflow

This repo enforces a Cursor rule (`.cursor/rules/prd-task-completion-workflow.mdc`) for any work tracked in `PRD.md`:
- Read `PRD.md` before starting a tracked task.
- State which PRD task you're working on and its acceptance criteria before implementing.
- After the code is written and confirmed working, immediately flip that item's checkbox from `[ ]` to `[x]`.
- Never mark a parent task complete unless every subtask is complete, and never mark anything complete unless it's fully implemented and confirmed working.

## Fix log — 2026-07-20

A full-codebase audit (Opus) surfaced several issues in the coaches feature; the Critical and Important ones were fixed:

**Critical**
- **Email HTML injection** — `server/src/services/emailService.js`: `player.username` and `coach.name` were interpolated unescaped into the coach-notification email HTML. Registration only limited username length (3-24 chars), not characters, so a username like `<a href="evil">click</a>` would render as a live link/markup in a real email sent to a coach. Added an `escapeHtml()` helper and applied it to both interpolated values (and the email subject).
- **Blank page on load error** — `client/src/pages/CoachDetailPage.tsx`: the coach-detail fetch only handled 404 (`notFound`); any other error (500, network failure) left the page silently blank. Added a `loadError` state + `detail.error` message (added to both `en` and `ka` locale files), mirroring the pattern already used in `CoachesPage.tsx`.

**Important**
- **Race condition in accept/decline** — `server/src/routes/coachBookingRoutes.js`: the handler read the booking's status in JS then wrote it in a separate query, so two near-simultaneous responses (double-click, or accept+decline firing together) could both pass the pending check. Replaced with an atomic conditional `updateMany({ where: { id, status: "pending" }, ... })` inside a transaction — only the first response wins, and the slot is only reopened if the decline update actually took effect.
- **Duplicated `getSafeRedirect`** — `client/src/pages/LoginPage.tsx` and `RegisterPage.tsx` each defined an identical copy of this security-sensitive open-redirect guard. Extracted to `client/src/lib/redirect.ts` and imported in both.
- **Duplicated slot/date formatting** — `CoachDetailPage.tsx` and `DashboardPage.tsx` each had their own `Intl.DateTimeFormat` logic for displaying booking times. Extracted `formatDateTime` and `formatSlotRange` into `client/src/lib/utils.ts` and reused in both.

**Not fixed — false positive on verification**
- The audit also flagged a "duplicated public header" between `CoachesPage.tsx` and `CoachDetailPage.tsx`. On inspection this doesn't apply: both are protected routes rendered inside the shared `AppShell` (see `App.tsx`), not standalone pages with their own header markup. No change made.

**Not fixed — left as noted, lower priority**
- CORS fully open (`cors()` in `app.js`, socket `origin: "*"`) — acceptable since auth is Bearer-token (not cookie) based, but worth restricting to the real client origin in production.
- `server/package.json` lists `"chesshub": "file:.."` (server depending on the whole monorepo root) — likely accidental, not yet confirmed or changed.
- Dead Vite-template leftovers (`client/src/main.ts`, `counter.ts`, unused template SVGs) — safe to delete, not yet removed.

## Performance pass (P0) — 2026-07-21

Goal: lower move latency and support more concurrent games while keeping gameplay server-authoritative and correct. Implemented P0 only; P1/P2 noted at the end.

**P0.1 — Friend move path: 3 DB ops/move → 1** (`server/src/realtime/gameRuntime.js`)
- Root cause: `submitMove()` did `loadGame()` at the top (read #1) and, for non-terminal moves, ended with `return getGameState(gameId)` which called `loadGame()` again (read #2) — plus the `persistLiveState()` write. Two of those reads were redundant because the game is already live in the `managedGames` Map.
- Fix: `upsertRuntime()` now stores a `runtime.game` metadata snapshot, refreshed at every point a Game row changes (create/join/finalize). `submitMove()` reads participants/status from that cache instead of re-querying, and builds its reply with `serializeGameState(game, runtime)` instead of a second `getGameState()` read. Net: a normal move is now **1 write, 0 reads** (down from 1 write, 2 reads), and a full DB round-trip is removed from the move ack latency path.
- Also: `finalizeGame()` now calls `forgetManagedGame()` after building final state, so finished games stop accumulating in memory (they re-seed from Postgres if read again).
- Why it helps under load: fewer Postgres round-trips per move → lower latency and far less DB connection pressure as concurrent games grow. Correctness unchanged: chess.js still validates every move server-side; status transitions still go through the DB and refresh the cache.

**P0.2 — Client: board no longer re-renders 4×/second** (`client/src/pages/FriendGamePage.tsx`)
- Root cause: a page-level `setInterval(setNow, 250)` re-rendered the whole page — including `<Chessboard>` — every 250ms.
- Fix: extracted a self-contained `<LiveClock>` component that owns its own 250ms ticker; removed the page-level `now` state and `liveClocks` memo. Only the side whose turn it is ticks; a stopped clock renders its frozen value. The board and rest of the page now re-render only on real game updates.

**P0.3 — AI: bounded Stockfish concurrency** (`server/src/services/stockfishService.js`)
- Root cause: `runStockfishCommand()` spawned a fresh Stockfish (WASM) process on every move with no ceiling — N simultaneous AI moves = N processes, which can exhaust the single Railway instance and take the socket server down with it.
- Fix: a FIFO semaphore (`STOCKFISH_MAX_CONCURRENCY`, default 2) caps concurrent searches; excess requests queue. `try/finally` guarantees the slot is always released. Depths (easy=6/medium=10/hard=14) and the 8s timeout are unchanged.
- Why it helps under load: the server can't be swamped by a burst of AI games. Note: this protects the server but does NOT reduce per-move latency (still spawn-per-move) — see P1.

**How to test manually**
- Friend games: open a game in two browsers, play moves. Everything should behave exactly as before (moves, clocks counting down, check/checkmate, resign, draw offer/accept/decline, timeout). Watch the server log / DB — there should be no read query on a normal move, only the update. Board should feel smoother (no 4/sec flicker); DevTools "Highlight re-renders" should show only the clock number updating between moves, not the board.
- AI games: play several games at once (or set `STOCKFISH_MAX_CONCURRENCY=1` and fire two moves) — replies still come back correctly, just queued; the server stays responsive.

**Remaining scale limits (honest)**
- AI replies still pay full process spawn + WASM init per move (cold start every time). **P1: reuse a pool of Stockfish processes** (send `position fen` per request) to cut latency.
- Friend clocks still live only in server memory and are lost on restart (accepted tradeoff); moves are persisted every move (durable). **P1: optionally debounce non-terminal persistence** — tradeoff: a crash could lose the last few unsaved moves.
- Single-instance only: the `managedGames` Map and Socket.io rooms are in-process, so you cannot run 2+ server instances. **P2: Redis Socket.io adapter + a shared/durable clock strategy** for horizontal scale-out.
- Rough single-instance ceiling after P0: comfortably ~100 concurrent friend games; AI is bounded by `STOCKFISH_MAX_CONCURRENCY` (default 2 in-flight searches, rest queue) — raise it to match available CPU cores, but each concurrent search is CPU-heavy.

**P0.4 — AI game: optimistic move rendering** (`client/src/pages/AiGamePage.tsx`)
- Symptom (reported by user): in Me-vs-Stockfish, your own move only appeared on the board *after* the AI replied — it felt laggy.
- Root cause: `handleMove()` awaited the `/ai-games/:id/move` response before calling `setGame()`, and the board renders `position={game.fen}`. That response only returns after Stockfish finishes searching (up to the 8s cap), so your move wasn't drawn until then. `acting` also stayed true during the wait, disabling dragging.
- Fix: apply the user's move locally with `chess.js` (`new Chess()` + `loadPgn` + `move`) and `setGame()` immediately, so the piece appears the instant it's dropped. The awaited server response (authoritative, includes the AI reply) then replaces that optimistic state; if the server rejects, the optimistic move is rolled back to the previous state. Illegal moves throw in chess.js 1.4.0, so they're caught and the piece snaps back without a network call.
- Note: this is a client-side perceived-latency fix. It does NOT make Stockfish reply faster — the AI move still lands after the search completes (that's the P1 pool). `chess.js@1.4.0` is already a client dep (hoisted to the workspace root).

**Status / next steps (as of 2026-07-21)**
- Landed: P0.1 (friend move path DB reads eliminated), P0.2 (client clock isolation), P0.3 (Stockfish concurrency cap). All compile/syntax-checked.
- NOT done yet: **P1 — Stockfish process pool (reuse engines, no cold-start)**. This is the change that actually makes *AI replies faster*; P0.3 only bounds concurrency, it does not reduce AI latency. Do not assume AI reply speed has improved yet.
- Awaiting: user is measuring overall game speed and will report results back. Revisit priorities (whether to build the P1 AI pool, or debounce persistence) after that report.
