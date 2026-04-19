# ChessHub Current Features (for UI/UX Design)

This document describes the currently implemented product behavior so UI/UX can be redesigned without changing feature intent.

## 1) Product Scope

ChessHub MVP currently supports:
- account registration/login
- dashboard with profile + recent games
- realtime friend-vs-friend chess
- AI chess vs Stockfish
- persisted game history/results in database

## 2) User Roles and Access

- All game routes are behind authentication.
- Unauthenticated users are redirected to login.
- A user can only access their own AI games.
- For friend games:
  - while a game is still waiting, link access is allowed to join
  - once active, only participants can access game state

## 3) Auth and Account Features

Implemented flows:
- Register with `username`, `email`, `password`
- Login with `email`, `password`
- JWT session token persisted in client state (Zustand + persistence)
- `/auth/me` available for authenticated profile fetch

Current UX behavior:
- Form loading states exist (`Creating account...`, `Logging in...`)
- Inline error message displays API failure reason

## 4) Main Navigation and Routes

Current app routes:
- Public:
  - `/login`
  - `/register`
- Protected:
  - `/dashboard`
  - `/new-game` (create friend game)
  - `/game/:gameId` (friend game room)
  - `/ai-game/new` (AI game setup)
  - `/ai-game/:gameId` (AI game play view)

## 5) Dashboard Features

Dashboard currently shows:
- username
- invite code
- quick actions:
  - Play vs Friend
  - Play vs AI
- list of last 5 friend games:
  - time control
  - status
  - result (if available)

UX states implemented:
- loading recent games
- error state when recent games fail
- empty state when no games exist

## 6) Friend Game Creation/Join

### Create
- User selects time control:
  - Bullet, Blitz, Rapid, Classical, Freestyle
- Server creates a waiting game and returns game ID
- Client shows shareable game URL

### Join
- Another authenticated user opens the link and joins
- Capacity and auth rules:
  - max two players
  - cannot join full/non-waiting game
- Game transitions from waiting -> active when second player joins

## 7) Realtime Friend Gameplay (Socket.io)

### Core realtime behavior
- Game room per game ID
- Server-authoritative move validation (chess.js on backend)
- Server broadcasts authoritative game state after accepted events

### Live game data shown in UI
- board position (FEN-driven)
- player names/colors
- whose turn it is
- check/checkmate/draw terminal status text
- per-side clock values
- pending draw offer indicator

### Supported player actions
- drag/drop move submit
- resign
- offer draw
- accept/decline draw offer

### Terminal conditions handled
- checkmate
- draw conditions
- resignation
- timeout (for timed controls)

### Persistence
Friend games persist:
- move list (`moves_json`)
- PGN
- result
- started/ended timestamps

## 8) Clock Behavior

- Clocks are managed server-side for friend games.
- Timed controls decrement based on active side.
- Freestyle uses no clock pressure.
- Timeout can auto-end game and set winner.

Important implementation note for design:
- Active clock runtime state is memory-backed; if backend restarts during a live game, active clock runtime resets.

## 9) Multiplayer Resilience

Current reconnect behavior:
- socket reconnect attempts enabled
- reconnect notice shown in UI
- client rejoins game room on reconnect
- duplicate submit protection on move/action buttons while request in-flight

## 10) AI Game Features (Stockfish)

### Create AI Game
User chooses:
- difficulty: easy / medium / hard
- player color: white / black

### AI gameplay
- legal user move validated server-side with chess.js
- backend calls Stockfish to compute AI reply
- AI reply returned and persisted
- board/result served via HTTP endpoints (non-socket flow)

### AI game persistence
Stored per AI game:
- user ID
- selected difficulty
- selected color
- PGN
- final result

## 11) Error and Validation Behavior

### API shape
- Validation errors return structured payload with code + message + issues
- Other errors return standardized code + message payload

### Client behavior
- Friendly inline errors shown in auth/dashboard/game pages
- Invalid/expired game links show explicit message
- Illegal moves are rejected with message from API

## 12) Current UX Gaps (Good Targets for Redesign)

Areas where UI/UX can significantly improve without changing backend logic:
- clearer move legality guidance (turn, piece ownership, legal capture direction)
- stronger in-game move feedback (preview, invalid reason detail)
- richer game status panel (move history, captured pieces, check alerts)
- better empty/error/loading visuals across pages
- clearer reconnect state and recovery messaging
- friend game lobby experience while waiting for opponent
- AI setup and in-game controls (difficulty/color clarity, rematch/new game CTAs)
- responsive/mobile-first board + side-panel layouts

## 13) Reference Endpoints (Implemented)

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

### Friend games
- `POST /games`
- `GET /games/:id`
- `POST /games/:id/join`
- `GET /games/recent`

### AI games
- `POST /ai-games`
- `GET /ai-games/:id`
- `POST /ai-games/:id/move`
