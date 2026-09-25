const { prisma } = require("../lib/prisma");
const { gameSelect, upsertRuntime } = require("./gameRuntime");

// How long a player waits in the queue before the server gives up and tells them
// "no opponent found" — enforced here (not just the client's countdown UI), so a
// stale entry can never sit in the queue forever.
const QUEUE_TIMEOUT_MS = 60_000;

// Time control used for matchmade games. A single constant (rather than something
// negotiated per-request) so it's trivial to make this configurable later — e.g. a
// time-control picker on the client — without touching the pairing logic itself.
const MATCHMAKING_TIME_CONTROL = "Rapid";

// userId -> { socket, timeout }. A user can only ever hold one entry (see joinQueue),
// so this map doubles as both "who is searching" and "which socket to notify".
const queue = new Map();

function removeFromQueue(userId) {
  const entry = queue.get(userId);

  if (!entry) {
    return;
  }

  clearTimeout(entry.timeout);
  queue.delete(userId);
}

/** Server-authoritative timeout — fires even if the client's own countdown UI never renders. */
function onQueueTimeout(userId) {
  const entry = queue.get(userId);

  if (!entry) {
    return;
  }

  removeFromQueue(userId);
  entry.socket.emit("matchmaking:timeout");
}

async function createMatchedGame(playerAId, playerBId) {
  const whitePlayerId = Math.random() < 0.5 ? playerAId : playerBId;
  const blackPlayerId = whitePlayerId === playerAId ? playerBId : playerAId;

  const game = await prisma.game.create({
    data: {
      whitePlayerId,
      blackPlayerId,
      timeControl: MATCHMAKING_TIME_CONTROL,
      status: "active",
      startedAt: new Date(),
      movesJson: [],
      pgn: "",
    },
    select: gameSelect,
  });

  // Warms the in-memory runtime immediately so the first `game:join` from either player
  // (same realtime flow as friend games — see socketHub.js) doesn't pay a cold DB read.
  upsertRuntime(game);

  return game;
}

/**
 * Called on `matchmaking:join`. Pairs with the longest-waiting opponent if one is already
 * queued (FIFO), otherwise enqueues this user and arms the server-side timeout. A match is
 * announced by emitting `matchmaking:matched` directly to both sockets, the caller included,
 * so the client only needs a single code path for "a game was found".
 */
async function joinQueue(socket) {
  const userId = socket.user.id;

  if (queue.has(userId)) {
    throw new Error("You're already searching for a game in another tab or window.");
  }

  // Longest-waiting opponent that isn't this same user — a user can never be paired
  // against their own queue entry.
  const waitingEntry = [...queue.entries()].find(([id]) => id !== userId);

  if (!waitingEntry) {
    const timeout = setTimeout(() => onQueueTimeout(userId), QUEUE_TIMEOUT_MS);
    queue.set(userId, { socket, timeout });
    return;
  }

  const [opponentId, opponentEntry] = waitingEntry;
  // Remove the opponent from the queue before the first `await` below so a third
  // `matchmaking:join` arriving while this game row is being created can never also
  // pair with them.
  removeFromQueue(opponentId);

  const game = await createMatchedGame(userId, opponentId);

  opponentEntry.socket.emit("matchmaking:matched", { gameId: game.id });
  socket.emit("matchmaking:matched", { gameId: game.id });
}

/** Cancel, disconnect, logout, and page-leave all funnel through here — only removes the
 * entry if it's still this exact socket, so a stale/late call can never evict a newer session. */
function leaveQueue(socket) {
  const userId = socket.user?.id;
  const entry = userId ? queue.get(userId) : null;

  if (entry && entry.socket.id === socket.id) {
    removeFromQueue(userId);
  }
}

module.exports = {
  joinQueue,
  leaveQueue,
  MATCHMAKING_TIME_CONTROL,
  QUEUE_TIMEOUT_MS,
};
