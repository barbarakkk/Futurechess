const { prisma } = require("../lib/prisma");
const { forgetManagedGame } = require("../realtime/gameRuntime");
const { emitGameRemoved } = require("../realtime/socketHub");

// An invite that nobody joins is closed automatically after this long.
const WAITING_GAME_TTL_MS = 10 * 60 * 1000;
const SWEEP_INTERVAL_MS = 30 * 1000;

function waitingCutoff() {
  return new Date(Date.now() - WAITING_GAME_TTL_MS);
}

/**
 * Deletes a game only if it is still "waiting" (plus any extra conditions), atomically — so a
 * concurrent join can never be cancelled/expired out from under the player who just joined.
 * Returns true if a row was removed. Connected clients are told via `game:removed`.
 */
async function removeWaitingGame(gameId, reason, extraWhere = {}) {
  const { count } = await prisma.game.deleteMany({
    where: { id: gameId, status: "waiting", ...extraWhere },
  });

  if (count === 0) {
    return false;
  }

  forgetManagedGame(gameId);
  emitGameRemoved(gameId, reason);
  return true;
}

/** Lazy check used by routes so an expired invite can't be opened/joined between sweeps. */
function expireIfStale(gameId) {
  return removeWaitingGame(gameId, "expired", { createdAt: { lt: waitingCutoff() } });
}

async function sweepExpiredWaitingGames() {
  try {
    const stale = await prisma.game.findMany({
      where: { status: "waiting", createdAt: { lt: waitingCutoff() } },
      select: { id: true },
    });
    for (const { id } of stale) {
      await removeWaitingGame(id, "expired");
    }
  } catch (error) {
    console.error("Failed to sweep expired waiting games:", error);
  }
}

function startWaitingGameSweeper() {
  void sweepExpiredWaitingGames();
  const timer = setInterval(sweepExpiredWaitingGames, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = {
  WAITING_GAME_TTL_MS,
  expireIfStale,
  removeWaitingGame,
  startWaitingGameSweeper,
  waitingCutoff,
};
