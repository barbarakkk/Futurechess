const { Router } = require("express");
const { Chess } = require("chess.js");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { runStockfishCommand } = require("../services/stockfishService");
const { createHttpError } = require("../utils/createHttpError");

const router = Router();

const aiCreateSchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard"]),
  userColor: z.enum(["white", "black"]),
});

const aiMoveSchema = z.object({
  from: z.string().regex(/^[a-h][1-8]$/),
  to: z.string().regex(/^[a-h][1-8]$/),
  promotion: z.enum(["q", "r", "b", "n"]).optional(),
});

function parsePgn(pgn) {
  const chess = new Chess();
  if (pgn) {
    try {
      chess.loadPgn(pgn);
    } catch (_error) {
      throw createHttpError(500, "Stored AI game PGN is invalid");
    }
  }
  return chess;
}

function serializeMove(move) {
  return {
    color: move.color,
    from: move.from,
    to: move.to,
    san: move.san,
    piece: move.piece,
    promotion: move.promotion ?? null,
  };
}

function getStatus(chess, result) {
  if (result) {
    return "finished";
  }
  if (chess.moveNumber() === 1 && chess.history().length === 0) {
    return "ready";
  }
  return "active";
}

function getResultFromBoard(chess) {
  if (chess.isCheckmate()) {
    return chess.turn() === "w" ? "0-1" : "1-0";
  }

  if (
    chess.isDraw() ||
    chess.isStalemate() ||
    chess.isInsufficientMaterial() ||
    chess.isThreefoldRepetition()
  ) {
    return "1/2-1/2";
  }

  return null;
}

function toAiGameState(aiGame, chess, lastMove = null) {
  return {
    id: aiGame.id,
    difficulty: aiGame.difficulty,
    userColor: aiGame.userColor,
    result: aiGame.result,
    status: getStatus(chess, aiGame.result),
    fen: chess.fen(),
    pgn: chess.pgn(),
    turn: chess.turn(),
    moves: chess.history({ verbose: true }).map(serializeMove),
    createdAt: aiGame.createdAt,
    lastMove: lastMove ? serializeMove(lastMove) : null,
  };
}

async function getOwnedAiGame(id, userId) {
  const aiGame = await prisma.aIGame.findUnique({ where: { id } });
  if (!aiGame || aiGame.userId !== userId) {
    throw createHttpError(404, "AI game not found");
  }
  return aiGame;
}

async function applyAiMoveIfNeeded(aiGame, chess) {
  const userTurn = aiGame.userColor === "white" ? "w" : "b";
  if (aiGame.result || chess.turn() === userTurn) {
    return null;
  }

  const bestMove = await runStockfishCommand({
    fen: chess.fen(),
    difficulty: aiGame.difficulty,
  });

  if (!bestMove || bestMove === "(none)") {
    return null;
  }

  const parsed = {
    from: bestMove.slice(0, 2),
    to: bestMove.slice(2, 4),
    promotion: bestMove.length > 4 ? bestMove.slice(4, 5) : undefined,
  };

  const aiMove = chess.move(parsed);
  if (!aiMove) {
    throw createHttpError(500, "Stockfish produced an illegal move");
  }

  return aiMove;
}

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const body = aiCreateSchema.parse(req.body);
    const chess = new Chess();

    const aiGame = await prisma.aIGame.create({
      data: {
        userId: req.user.id,
        difficulty: body.difficulty,
        userColor: body.userColor,
        pgn: "",
        result: null,
      },
    });

    const openingAiMove =
      body.userColor === "black" ? await applyAiMoveIfNeeded(aiGame, chess) : null;

    const result = getResultFromBoard(chess);
    const updated = await prisma.aIGame.update({
      where: { id: aiGame.id },
      data: {
        pgn: chess.pgn(),
        result,
      },
    });

    res.status(201).json({
      game: toAiGameState(updated, chess, openingAiMove),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const aiGame = await getOwnedAiGame(req.params.id, req.user.id);
    const chess = parsePgn(aiGame.pgn ?? "");

    res.json({ game: toAiGameState(aiGame, chess) });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/move", requireAuth, async (req, res, next) => {
  try {
    const body = aiMoveSchema.parse(req.body);
    const aiGame = await getOwnedAiGame(req.params.id, req.user.id);

    if (aiGame.result) {
      throw createHttpError(400, "Game is already finished");
    }

    const chess = parsePgn(aiGame.pgn ?? "");
    const userTurn = aiGame.userColor === "white" ? "w" : "b";

    if (chess.turn() !== userTurn) {
      throw createHttpError(400, "It is not your turn");
    }

    const userMove = chess.move({
      from: body.from,
      to: body.to,
      promotion: body.promotion,
    });

    if (!userMove) {
      throw createHttpError(400, "Illegal move");
    }

    let result = getResultFromBoard(chess);
    let aiMove = null;

    if (!result) {
      aiMove = await applyAiMoveIfNeeded(aiGame, chess);
      result = getResultFromBoard(chess);
    }

    const updated = await prisma.aIGame.update({
      where: { id: aiGame.id },
      data: {
        pgn: chess.pgn(),
        result,
      },
    });

    res.json({
      game: toAiGameState(updated, chess, aiMove),
      userMove: serializeMove(userMove),
      aiMove: aiMove ? serializeMove(aiMove) : null,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = { aiGameRouter: router };
