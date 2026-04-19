# FutureChess MVP PRD

## 1) Product Summary

FutureChess is a web-only chess platform MVP built from scratch with exactly:
- Auth (register/login, invite code, JWT)
- Play vs Friend (real-time multiplayer with clocks)
- Play vs AI (Stockfish via HTTP move loop)

## 2) Scope

### In Scope
- Username/email/password auth with bcrypt hashing
- Invite code generation format `FC-XXXX`
- JWT-based authenticated sessions
- Real-time friend games via Socket.io
- Server-authoritative clocks for friend games
- AI games with Easy/Medium/Hard difficulty
- Game persistence (friend + AI)

### Out of Scope
- Ratings / ELO
- Game analysis
- Tournaments
- Spectator mode
- Matchmaking queue
- Mobile app
- Chat
- Expanded profiles

## 3) Required Stack

- Frontend: React 18 + Vite, react-chessboard, chess.js, Zustand, Tailwind, Socket.io-client, Axios, React Router v6
- Backend: Node.js, Express, Socket.io, JWT, bcryptjs, Zod, Prisma, Stockfish npm package
- Database: PostgreSQL (Supabase)
- Hosting: Vercel (client), Railway (server)

## 4) Required Repository Structure

Root should contain:
- `client/`
- `server/`
- `.env.example`
- `.gitignore`
- `README.md`
- `PRD.md`

## 5) Data Model (MVP)

- `users`: id, username, email, password_hash, user_code, created_at
- `games`: id, white_player_id, black_player_id, time_control, status, result, moves_json, pgn, started_at, ended_at
- `ai_games`: id, user_id, difficulty, user_color, result, pgn, created_at

## 6) Pages (MVP)

- `/register`
- `/login`
- `/dashboard`
- `/new-game`
- `/game/:gameId`
- `/ai-game/:gameId`

---

## 7) Implementation Tasks (Checkbox Tracker)

> Rule: Never mark a parent task complete until all subtasks are complete.

### Task 1: Scaffold Monorepo
**Acceptance Criteria**
- `client/` and `server/` are created.
- Client starts with Vite React dev server.
- Server starts with Express dev server.
- All required base dependencies for Task 1 are installed.
- One root command starts both dev servers via `concurrently`.

- [x] Task 1 complete
  - [x] Create `client/` (Vite React) and verify it runs.
  - [x] Create `server/` (Express) and verify it runs.
  - [x] Add basic hello-world route in server.
  - [x] Add root scripts to run both services with `concurrently`.
  - [x] Verify both services run from one command.

### Task 2: Backend Foundation (Prisma + DB + Core Setup)
**Acceptance Criteria**
- Prisma is configured against Supabase Postgres.
- Initial schema includes `users`, `games`, `ai_games`.
- Migration runs successfully.
- Express has env + CORS + JSON parsing setup.
- Shared validation/util wiring exists for upcoming auth/game routes.

- [x] Task 2 complete
  - [x] Configure environment management in server.
  - [x] Initialize Prisma in `server/`.
  - [x] Define Prisma models for `users`, `games`, `ai_games`.
  - [x] Run initial migration successfully.
  - [x] Add base Express middleware (CORS, JSON, error shell).
  - [x] Add invite code generator utility (`FC-XXXX`) with uniqueness strategy.

### Task 3: Auth API + Client Auth Pages
**Acceptance Criteria**
- User can register with username/email/password.
- Password stored hashed via bcrypt.
- Invite code generated on registration.
- User can log in and receive JWT.
- Client has working `/register` and `/login` screens.
- Protected routes require valid auth state.

- [x] Task 3 complete
  - [x] Implement `POST /auth/register` with Zod validation.
  - [x] Implement `POST /auth/login` with credential verification.
  - [x] Implement JWT issuance and auth middleware.
  - [x] Build `/register` page and wire API.
  - [x] Build `/login` page and wire API.
  - [x] Implement client auth state (Zustand + token persistence).
  - [x] Add route guards for authenticated pages.

### Task 4: Dashboard + Navigation
**Acceptance Criteria**
- `/dashboard` shows username + invite code.
- Dashboard includes actions for friend game and AI game.
- Dashboard shows last 5 games.
- Navigation to game creation flows works.

- [x] Task 4 complete
  - [x] Build `/dashboard` UI skeleton.
  - [x] Display current user basic info + invite code.
  - [x] Add "Play vs Friend" and "Play vs AI" actions.
  - [x] Add last-5-games API and UI rendering.
  - [x] Wire navigation to `/new-game` and active game routes.

### Task 5: Friend Game Creation + Join Flow
**Acceptance Criteria**
- Authenticated user can create a friend game with time control.
- Shareable link is generated and usable.
- Friend can join via link.
- Game enforces max two players and participant authorization.

- [x] Task 5 complete
  - [x] Implement `POST /games` create endpoint.
  - [x] Implement `GET /games/:id` fetch endpoint.
  - [x] Implement `POST /games/:id/join` join endpoint.
  - [x] Persist time control + initial game status.
  - [x] Enforce participant and capacity rules.
  - [x] Expose shareable game URL to client.

### Task 6: Realtime Multiplayer Gameplay + Clocks
**Acceptance Criteria**
- Both players receive synchronized board state in real time.
- Moves are validated server-side and broadcast correctly.
- Clocks decrement server-side according to selected time control.
- Game can end by checkmate, timeout, resign, or draw agreement.
- Final state/result persisted in DB.

- [x] Task 6 complete
  - [x] Set up Socket.io rooms by game ID.
  - [x] Add move submit event with server-side chess validation.
  - [x] Broadcast authoritative game state after accepted moves.
  - [x] Implement server-side clock management per game.
  - [x] Implement resign and draw-agreement events.
  - [x] Implement timeout detection and terminal result handling.
  - [x] Persist `moves_json`, `pgn`, `result`, `started_at`, `ended_at`.

### Task 7: Play vs AI (Stockfish)
**Acceptance Criteria**
- User can create AI game with difficulty + color.
- User submits legal move via HTTP endpoint.
- Server returns AI move from Stockfish.
- AI game state and result are persisted.
- No clock pressure is applied in AI mode.

- [x] Task 7 complete
  - [x] Implement `POST /ai-games` create endpoint.
  - [x] Implement `GET /ai-games/:id` fetch endpoint.
  - [x] Implement `POST /ai-games/:id/move` endpoint.
  - [x] Integrate Stockfish engine and map difficulty settings.
  - [x] Validate legal moves with chess.js before AI response.
  - [x] Persist AI game PGN and final result.

### Task 8: UX Hardening + Validation
**Acceptance Criteria**
- Core flows handle loading/error states cleanly.
- Invalid game links and illegal moves return user-friendly errors.
- Basic reconnect behavior for multiplayer is handled.
- Input validation is consistently applied.

- [x] Task 8 complete
  - [x] Add loading/error states on auth, dashboard, and game pages.
  - [x] Normalize API error responses and client error display.
  - [x] Handle invalid/expired game links in UI.
  - [x] Add duplicate-submit protections for moves/actions.
  - [x] Implement basic socket reconnect strategy.

### Task 9: Deployment + Documentation + Smoke Test
**Acceptance Criteria**
- `.env.example` documents required environment variables.
- Frontend deployable to Vercel, backend deployable to Railway.
- Supabase DB connectivity documented and verified.
- README includes local setup and run instructions.
- MVP smoke tests pass manually.

- [x] Task 9 complete
  - [x] Finalize `.env.example` for client + server.
  - [x] Write complete `README.md` setup and run guide.
  - [x] Add deployment notes for Vercel and Railway.
  - [x] Run and document smoke test checklist for MVP flows.

---

## 8) Definition of Done (MVP)

MVP is done when:
- [ ] Users can register/login with secure password storage and JWT sessions.
- [ ] Invite code `FC-XXXX` is generated and visible on dashboard.
- [ ] Friend games are created/joined via shareable link.
- [ ] Multiplayer board sync is real-time and server-authoritative.
- [ ] Friend game termination works for checkmate/timeout/resign/draw.
- [ ] AI games work with difficulty + color selection and valid AI responses.
- [ ] Results are persisted for friend and AI games.
- [ ] Last 5 games render on dashboard.
- [ ] Single command runs both dev servers locally.
