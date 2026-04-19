# ChessHub MVP

ChessHub is a full-stack chess MVP with:
- JWT auth and invite-code profiles
- Realtime friend games (Socket.io, server-authoritative moves/clocks)
- Play vs AI (Stockfish-backed move responses)
- Supabase Postgres persistence via Prisma

## Tech Stack

- **Client:** React + Vite + TypeScript + Zustand + axios + react-chessboard
- **Server:** Node.js + Express + Socket.io + Prisma + Zod
- **Database:** Supabase Postgres

## Project Structure

- `client/` frontend app
- `server/` API, realtime game engine, Prisma schema/migrations
- root `package.json` convenience script to run both dev servers

## Environment Variables

Create local env files from examples:

- `server/.env.example` -> `server/.env`
- `client/.env.example` -> `client/.env`

### Server (`server/.env`)

- `PORT` - API port (default `4000`)
- `JWT_SECRET` - secret used to sign auth tokens
- `DATABASE_URL` - Supabase pooled connection string (runtime/API queries)
- `DIRECT_URL` - optional direct Supabase URL for migrations

### Client (`client/.env`)

- `VITE_API_URL` - backend base URL, for example `http://localhost:4000`

## Local Setup

### 1) Install dependencies

From the repository root:

```bash
npm install
npm install --prefix server
npm install --prefix client
```

### 2) Configure database and Prisma

```bash
cd server
npx prisma generate
npx prisma migrate dev
```

### 3) Start development servers

From root:

```bash
npm run dev
```

This runs:
- frontend at `http://localhost:5173`
- backend at `http://localhost:4000`

## Production Build

### Client

```bash
cd client
npm run build
```

### Server

```bash
cd server
npm run start
```

## Deployment Notes

### Deploy Frontend to Vercel

1. Import this repo into Vercel.
2. Set **Root Directory** to `client`.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add env var:
   - `VITE_API_URL=https://<your-railway-backend-domain>`

### Deploy Backend to Railway

1. Create a new Railway project from this repo.
2. Set **Root Directory** to `server`.
3. Start command: `npm run start`
4. Add env vars:
   - `PORT` (Railway may inject automatically)
   - `JWT_SECRET`
   - `DATABASE_URL`
   - `DIRECT_URL` (recommended for migrations)
5. Run migrations on deploy or manually:
   - `npx prisma migrate deploy`

## Supabase Connectivity Verification

With `server/.env` set:

```bash
cd server
npx prisma migrate status
```

Expected: Prisma can reach the DB and report migration state.

Optional runtime check:

```bash
cd server
node -r dotenv/config -e "const { prisma } = require('./src/lib/prisma'); prisma.$queryRaw`SELECT 1`.then(() => { console.log('DB OK'); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });"
```

## API Surface (MVP)

- Auth:
  - `POST /auth/register`
  - `POST /auth/login`
  - `GET /auth/me`
- Friend games:
  - `POST /games`
  - `GET /games/:id`
  - `POST /games/:id/join`
  - `GET /games/recent`
- AI games:
  - `POST /ai-games`
  - `GET /ai-games/:id`
  - `POST /ai-games/:id/move`

## Smoke Test Checklist (MVP)

Run with local frontend + backend both running.

- [ ] Register a new account successfully.
- [ ] Login with same account and reach dashboard.
- [ ] Dashboard shows username + invite code and no blocking errors.
- [ ] Create friend game, copy link, and open it in another browser/session.
- [ ] Second user joins same friend game successfully.
- [ ] Friend game moves sync in realtime for both players.
- [ ] Illegal move shows user-friendly error and is rejected.
- [ ] Resign and draw flows end game with correct persisted result.
- [ ] Timeout can end a clocked game with correct winner.
- [ ] Create AI game (all difficulties/colors).
- [ ] Submit legal move in AI game and receive Stockfish reply.
- [ ] AI game rejects illegal move with user-friendly error.
- [ ] Recent games list updates with completed results.

### Smoke Test Log (Current)

- [x] Client production build succeeds (`npm run build` in `client/`).
- [x] Backend API smoke script passed (auth, friend game create/join/fetch, AI game create/move/fetch).
- [ ] Full browser/manual flow still needs to be executed end-to-end with two authenticated sessions for realtime visual verification.

## Notes

- Do not commit real credentials; use `.env` locally and `.env.example` as template.
- Current realtime friend clocks are in-memory runtime state; a server restart during active games resets live clock state.
