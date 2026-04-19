const { Chess } = require("chess.js");
const { prisma } = require("../lib/prisma");
const { createHttpError } = require("../utils/createHttpError");

const TIME_CONTROL_MS = {
  Bullet: 60_000,
  Blitz: 5 * 60_000,
  Rapid: 10 * 60_000,
  Classical: 30 * 60_000,
  Freestyle: 0,
};

const managedGames = new Map();

const gameSelect = {
  id: true,
  whitePlayerId: true,
  blackPlayerId: true,
  timeControl: true,
  status: true,
  result: true,
  movesJson: true,
  pgn: true,
  startedAt: true,
  endedAt: true,
  whitePlayer: {
    select: {
      id: true,
      username: true,
    },
  },
  blackPlayer: {
    select: {
      id: true,
      username: true,
    },
  },
};

function getInitialClockMs(timeControl) {
  return TIME_CONTROL_MS[timeControl] ?? TIME_CONTROL_MS.Blitz;
}

function getPlayerColor(game, userId) {
  if (game.whitePlayerId === userId) {
    return "w";
  }

  if (game.blackPlayerId === userId) {
    return "b";
  }

  return null;
}

function toPersistedMove(move) {
  return {
    color: move.color,
    from: move.from,
    to: move.to,
    piece: move.piece,
    promotion: move.promotion ?? null,
    san: move.san,
    lan: move.lan,
    before: move.before,
    after: move.after,
  };
}

/** Plain-language hint when chess.move({ from, to, promotion }) returns null */
function explainIllegalMove(chess, playerColor, payload) {
  const rawFrom = payload?.from;
  const rawTo = payload?.to;

  if (typeof rawFrom !== "string" || typeof rawTo !== "string") {
    return "Use both a starting square and a destination square on the board.";
  }

  if (rawFrom.length < 2 || rawTo.length < 2) {
    return "Each square must be a file letter (a–h) and a rank number (1–8), like e2 or e4.";
  }

  const from = `${rawFrom[0].toLowerCase()}${rawFrom[1].toLowerCase()}`;
  const to = `${rawTo[0].toLowerCase()}${rawTo[1].toLowerCase()}`;
  const sqRe = /^[a-h][1-8]$/;

  if (!sqRe.test(from) || !sqRe.test(to)) {
    return "Those squares aren't valid — files go a–h and ranks go 1–8.";
  }

  const piece = chess.get(from);
  const label = (sq) => `${sq[0].toUpperCase()}${sq[1]}`;

  if (!piece) {
    return `There's no piece on ${label(from)} — choose one of your pieces to move.`;
  }

  if (piece.color !== playerColor) {
    return "That's your opponent's piece — you can only move your own pieces.";
  }

  const legalFromHere = chess.moves({ square: from, verbose: true });

  if (legalFromHere.length === 0) {
    if (chess.inCheck()) {
      return "You're in check and this piece can't legally resolve it — block the check, capture the attacker, or move your king to a safe square.";
    }
    return "This piece has no legal moves from this square — it may be pinned or completely blocked.";
  }

  const landsOnTo = legalFromHere.filter((m) => m.to === to);

  if (landsOnTo.length === 0) {
    if (chess.inCheck()) {
      return "That move doesn't get you out of check — you must block, capture the attacker, or move the king legally.";
    }
    return `That piece can't legally land on ${label(to)} from ${label(from)} — it might not move that way, the path may be blocked, or your king would be in check.`;
  }

  if (landsOnTo.some((m) => Boolean(m.promotion))) {
    return "This pawn must promote on the last rank — the move needs a promotion piece (usually a queen).";
  }

  return "That move isn't legal in this position.";
}

function rehydrateChess(movesJson) {
  const chess = new Chess();
  const persistedMoves = Array.isArray(movesJson) ? movesJson : [];

  for (const move of persistedMoves) {
    const moveInput =
      move && typeof move === "object"
        ? move.from && move.to
          ? {
              from: move.from,
              to: move.to,
              promotion: move.promotion || undefined,
            }
          : move.san
            ? move.san
            : null
        : typeof move === "string"
          ? move
          : null;

    if (!moveInput || !chess.move(moveInput)) {
      throw createHttpError(500, "Stored game moves are invalid");
    }
  }

  return {
    chess,
    moves: persistedMoves,
  };
}

function applyElapsedClock(runtime, now = Date.now()) {
  if (!runtime.activeSince || runtime.baseClockMs <= 0) {
    return;
  }

  const elapsed = Math.max(0, now - runtime.activeSince);
  runtime.clocks[runtime.activeColor] = Math.max(
    0,
    runtime.clocks[runtime.activeColor] - elapsed,
  );
  runtime.activeSince = now;
}

function getClockSnapshot(runtime, now = Date.now()) {
  const whiteMs =
    runtime.activeSince &&
    runtime.activeColor === "w" &&
    runtime.baseClockMs > 0
      ? Math.max(0, runtime.clocks.w - (now - runtime.activeSince))
      : runtime.clocks.w;

  const blackMs =
    runtime.activeSince &&
    runtime.activeColor === "b" &&
    runtime.baseClockMs > 0
      ? Math.max(0, runtime.clocks.b - (now - runtime.activeSince))
      : runtime.clocks.b;

  return { whiteMs, blackMs };
}

function forgetManagedGame(gameId) {
  managedGames.delete(gameId);
}

function upsertRuntime(game) {
  const current = managedGames.get(game.id);
  const baseClockMs = getInitialClockMs(game.timeControl);

  if (!current) {
    const { chess, moves } = rehydrateChess(game.movesJson);
    const runtime = {
      gameId: game.id,
      chess,
      moves,
      baseClockMs,
      clocks: {
        w: baseClockMs,
        b: baseClockMs,
      },
      activeColor: chess.turn(),
      activeSince:
        game.status === "active" && !game.result && baseClockMs > 0
          ? Date.now()
          : null,
      drawOffers: {
        w: false,
        b: false,
      },
    };

    managedGames.set(game.id, runtime);
    return runtime;
  }

  current.baseClockMs = baseClockMs;
  current.activeColor = current.chess.turn();

  if (game.status === "active" && !game.result && baseClockMs > 0) {
    current.activeSince ??= Date.now();
  } else {
    current.activeSince = null;
  }

  return current;
}

async function loadGame(gameId) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: gameSelect,
  });

  if (!game) {
    throw createHttpError(404, "Game not found");
  }

  return game;
}

async function persistLiveState(gameId, runtime) {
  return prisma.game.update({
    where: { id: gameId },
    data: {
      movesJson: runtime.moves,
      pgn: runtime.chess.pgn(),
    },
    select: gameSelect,
  });
}

function getTimeoutResult(color) {
  return color === "w" ? "0-1" : "1-0";
}

async function finalizeGame(game, runtime, { result, reason }) {
  applyElapsedClock(runtime);
  runtime.activeSince = null;
  runtime.drawOffers = { w: false, b: false };

  const updated = await prisma.game.update({
    where: { id: game.id },
    data: {
      status: "finished",
      result,
      endedAt: new Date(),
      movesJson: runtime.moves,
      pgn: runtime.chess.pgn(),
    },
    select: gameSelect,
  });

  return serializeGameState(updated, runtime, reason);
}

function serializeGameState(game, runtime, terminalReason = null) {
  const now = Date.now();
  const clocks = runtime ? getClockSnapshot(runtime, now) : { whiteMs: 0, blackMs: 0 };
  const drawOfferBy = runtime?.drawOffers.w ? "w" : runtime?.drawOffers.b ? "b" : null;

  return {
    id: game.id,
    status: game.status,
    result: game.result,
    timeControl: game.timeControl,
    startedAt: game.startedAt,
    endedAt: game.endedAt,
    whitePlayerId: game.whitePlayerId,
    blackPlayerId: game.blackPlayerId,
    players: {
      white: game.whitePlayer
        ? { id: game.whitePlayer.id, username: game.whitePlayer.username }
        : null,
      black: game.blackPlayer
        ? { id: game.blackPlayer.id, username: game.blackPlayer.username }
        : null,
    },
    fen: runtime?.chess.fen() ?? new Chess().fen(),
    pgn: runtime?.chess.pgn() ?? game.pgn ?? "",
    moves: runtime?.moves ?? (Array.isArray(game.movesJson) ? game.movesJson : []),
    turn: runtime?.chess.turn() ?? "w",
    isCheck: runtime?.chess.inCheck() ?? false,
    clocks,
    drawOfferBy,
    terminalReason,
    serverNow: new Date(now).toISOString(),
  };
}

async function getGameState(gameId) {
  const game = await loadGame(gameId);
  const runtime = upsertRuntime(game);

  if (game.status === "active" && !game.result && runtime.baseClockMs > 0) {
    const clocks = getClockSnapshot(runtime);

    if (clocks.whiteMs <= 0) {
      return finalizeGame(game, runtime, {
        result: getTimeoutResult("w"),
        reason: "timeout",
      });
    }

    if (clocks.blackMs <= 0) {
      return finalizeGame(game, runtime, {
        result: getTimeoutResult("b"),
        reason: "timeout",
      });
    }
  }

  return serializeGameState(game, runtime);
}

async function submitMove(gameId, userId, payload) {
  const game = await loadGame(gameId);

  if (game.status !== "active" || game.result) {
    throw createHttpError(400, "Game is not active");
  }

  const playerColor = getPlayerColor(game, userId);

  if (!playerColor) {
    throw createHttpError(403, "You are not a participant in this game");
  }

  const runtime = upsertRuntime(game);
  const clocks = getClockSnapshot(runtime);

  if (clocks.whiteMs <= 0 || clocks.blackMs <= 0) {
    return getGameState(gameId);
  }

  if (runtime.chess.turn() !== playerColor) {
    throw createHttpError(400, "It is not your turn");
  }

  applyElapsedClock(runtime);

  const move = runtime.chess.move({
    from: payload.from,
    to: payload.to,
    promotion: payload.promotion || undefined,
  });

  if (!move) {
    throw createHttpError(
      400,
      explainIllegalMove(runtime.chess, playerColor, payload),
    );
  }

  runtime.moves.push(toPersistedMove(move));
  runtime.activeColor = runtime.chess.turn();
  runtime.activeSince =
    game.timeControl === "Freestyle" ? null : Date.now();
  runtime.drawOffers = { w: false, b: false };

  await persistLiveState(game.id, runtime);

  if (runtime.chess.isCheckmate()) {
    return finalizeGame(game, runtime, {
      result: move.color === "w" ? "1-0" : "0-1",
      reason: "checkmate",
    });
  }

  if (
    runtime.chess.isDraw() ||
    runtime.chess.isStalemate() ||
    runtime.chess.isInsufficientMaterial() ||
    runtime.chess.isThreefoldRepetition()
  ) {
    return finalizeGame(game, runtime, {
      result: "1/2-1/2",
      reason: "draw",
    });
  }

  return getGameState(gameId);
}

async function resignGame(gameId, userId) {
  const game = await loadGame(gameId);
  const playerColor = getPlayerColor(game, userId);

  if (!playerColor) {
    throw createHttpError(403, "You are not a participant in this game");
  }

  if (game.status !== "active" || game.result) {
    throw createHttpError(400, "Game is not active");
  }

  const runtime = upsertRuntime(game);

  return finalizeGame(game, runtime, {
    result: playerColor === "w" ? "0-1" : "1-0",
    reason: "resign",
  });
}

async function handleDrawResponse(gameId, userId, accept) {
  const game = await loadGame(gameId);
  const playerColor = getPlayerColor(game, userId);

  if (!playerColor) {
    throw createHttpError(403, "You are not a participant in this game");
  }

  if (game.status !== "active" || game.result) {
    throw createHttpError(400, "Game is not active");
  }

  const runtime = upsertRuntime(game);
  const opponentColor = playerColor === "w" ? "b" : "w";

  if (accept) {
    if (!runtime.drawOffers[opponentColor]) {
      throw createHttpError(400, "There is no draw offer to accept");
    }

    return finalizeGame(game, runtime, {
      result: "1/2-1/2",
      reason: "draw-agreement",
    });
  }

  runtime.drawOffers[opponentColor] = false;
  return getGameState(gameId);
}

async function offerDraw(gameId, userId) {
  const game = await loadGame(gameId);
  const playerColor = getPlayerColor(game, userId);

  if (!playerColor) {
    throw createHttpError(403, "You are not a participant in this game");
  }

  if (game.status !== "active" || game.result) {
    throw createHttpError(400, "Game is not active");
  }

  const runtime = upsertRuntime(game);
  runtime.drawOffers[playerColor] = true;

  return getGameState(gameId);
}

module.exports = {
  forgetManagedGame,
  gameSelect,
  getGameState,
  getPlayerColor,
  handleDrawResponse,
  offerDraw,
  serializeGameState,
  submitMove,
  upsertRuntime,
  resignGame,
};
