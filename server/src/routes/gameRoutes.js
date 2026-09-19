const { Router } = require("express");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { broadcastGameState } = require("../realtime/socketHub");
const { gameSelect, getGameState, upsertRuntime } = require("../realtime/gameRuntime");
const { createHttpError } = require("../utils/createHttpError");

const router = Router();

/** Friend games visible in this user's history/dashboard (excludes games they removed from their list). */
function visibleParticipantGamesWhere(userId) {
  return {
    AND: [
      {
        OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
      },
      {
        NOT: {
          hiddenByUsers: {
            some: { userId },
          },
        },
      },
    ],
  };
}

const timeControlSchema = z.enum([
  "Bullet",
  "Blitz",
  "Rapid",
  "Classical",
  "Freestyle",
]);

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const body = z
      .object({
        timeControl: timeControlSchema,
      })
      .parse(req.body);

    const game = await prisma.game.create({
      data: {
        whitePlayerId: req.user.id,
        blackPlayerId: null,
        timeControl: body.timeControl,
        status: "waiting",
        startedAt: null,
        movesJson: [],
        pgn: "",
      },
      select: gameSelect,
    });

    upsertRuntime(game);

    res.status(201).json({ game: await getGameState(game.id) });
  } catch (error) {
    next(error);
  }
});

router.get("/recent", requireAuth, async (req, res, next) => {
  try {
    const games = await prisma.game.findMany({
      where: visibleParticipantGamesWhere(req.user.id),
      orderBy: { startedAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        result: true,
        timeControl: true,
        startedAt: true,
        endedAt: true,
        whitePlayerId: true,
        whitePlayer: { select: { username: true } },
        blackPlayer: { select: { username: true } },
      },
    });

    // The dashboard shows who the game was against — derive that from whichever
    // side isn't the requesting user rather than exposing both player objects.
    res.json({
      games: games.map(({ whitePlayerId, whitePlayer, blackPlayer, ...game }) => ({
        ...game,
        opponentUsername: (whitePlayerId === req.user.id ? blackPlayer : whitePlayer)?.username ?? null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/history", requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50),
    );

    const games = await prisma.game.findMany({
      where: visibleParticipantGamesWhere(req.user.id),
      orderBy: [{ endedAt: "desc" }, { startedAt: "desc" }],
      take: limit,
      select: {
        id: true,
        timeControl: true,
        status: true,
        result: true,
        startedAt: true,
        endedAt: true,
        whitePlayerId: true,
        blackPlayerId: true,
        whitePlayer: { select: { id: true, username: true } },
        blackPlayer: { select: { id: true, username: true } },
      },
    });

    const userId = req.user.id;

    const items = games.map((game) => {
      const playedAsWhite = game.whitePlayerId === userId;
      const playedAsBlack = game.blackPlayerId === userId;
      const opponent = playedAsWhite ? game.blackPlayer : game.whitePlayer;
      const yourColor = playedAsWhite ? "white" : "black";

      let outcome = "ongoing";
      if (game.status === "waiting") {
        outcome = "waiting";
      } else if (!game.result) {
        outcome = "ongoing";
      } else if (game.result === "1/2-1/2") {
        outcome = "draw";
      } else if (game.result === "1-0") {
        outcome = playedAsWhite ? "win" : "loss";
      } else if (game.result === "0-1") {
        outcome = playedAsBlack ? "win" : "loss";
      }

      return {
        id: game.id,
        timeControl: game.timeControl,
        status: game.status,
        result: game.result,
        startedAt: game.startedAt,
        endedAt: game.endedAt,
        yourColor,
        opponent: opponent
          ? { id: opponent.id, username: opponent.username }
          : null,
        outcome,
      };
    });

    const summary = {
      total: items.length,
      wins: items.filter((g) => g.outcome === "win").length,
      losses: items.filter((g) => g.outcome === "loss").length,
      draws: items.filter((g) => g.outcome === "draw").length,
      ongoing: items.filter((g) => g.outcome === "ongoing" || g.outcome === "waiting")
        .length,
    };

    res.json({ games: items, summary });
  } catch (error) {
    next(error);
  }
});

router.get("/stats", requireAuth, async (req, res, next) => {
  try {
    const [friendGames, aiGames] = await Promise.all([
      prisma.game.findMany({
        where: visibleParticipantGamesWhere(req.user.id),
        select: {
          id: true,
          result: true,
          whitePlayerId: true,
          blackPlayerId: true,
          startedAt: true,
          endedAt: true,
        },
      }),
      prisma.aIGame.findMany({
        where: { userId: req.user.id },
        select: {
          id: true,
          result: true,
          userColor: true,
          createdAt: true,
        },
      }),
    ]);

    const totalGames = friendGames.length + aiGames.length;

    const friendCompleted = friendGames.filter((game) => Boolean(game.result));
    const aiCompleted = aiGames.filter((game) => Boolean(game.result));
    const completedGames = friendCompleted.length + aiCompleted.length;

    let wins = 0;
    let draws = 0;

    for (const game of friendCompleted) {
      if (
        (game.result === "1-0" && game.whitePlayerId === req.user.id) ||
        (game.result === "0-1" && game.blackPlayerId === req.user.id)
      ) {
        wins += 1;
      } else if (game.result === "1/2-1/2") {
        draws += 1;
      }
    }

    for (const game of aiCompleted) {
      if (
        (game.result === "1-0" && game.userColor === "white") ||
        (game.result === "0-1" && game.userColor === "black")
      ) {
        wins += 1;
      } else if (game.result === "1/2-1/2") {
        draws += 1;
      }
    }

    const losses = completedGames - wins - draws;
    const winRate = completedGames > 0 ? Math.round((wins / completedGames) * 100) : 0;
    const lossRate = completedGames > 0 ? Math.round((losses / completedGames) * 100) : 0;

    const streakEntries = [
      ...friendCompleted.map((game) => {
        const isWin =
          (game.result === "1-0" && game.whitePlayerId === req.user.id) ||
          (game.result === "0-1" && game.blackPlayerId === req.user.id);
        return {
          isWin,
          date: game.endedAt || game.startedAt || new Date(0),
        };
      }),
      ...aiCompleted.map((game) => {
        const isWin =
          (game.result === "1-0" && game.userColor === "white") ||
          (game.result === "0-1" && game.userColor === "black");
        return {
          isWin,
          date: game.createdAt,
        };
      }),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let currentStreak = 0;
    for (const entry of streakEntries) {
      if (!entry.isWin) {
        break;
      }
      currentStreak += 1;
    }

    res.json({
      stats: {
        totalGames,
        winRate,
        currentStreak,
        wins,
        draws,
        losses,
        lossRate,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const game = await prisma.game.findUnique({
      where: { id: req.params.id },
      select: gameSelect,
    });

    if (!game) {
      throw createHttpError(404, "Game not found");
    }

    const isParticipant =
      game.whitePlayerId === req.user.id || game.blackPlayerId === req.user.id;

    if (!isParticipant && game.status !== "waiting") {
      throw createHttpError(403, "You are not a participant in this game");
    }

    res.json({ game: await getGameState(game.id) });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const game = await prisma.game.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        whitePlayerId: true,
        blackPlayerId: true,
        status: true,
      },
    });

    if (!game) {
      throw createHttpError(404, "Game not found");
    }

    const isParticipant =
      game.whitePlayerId === req.user.id || game.blackPlayerId === req.user.id;

    if (!isParticipant) {
      throw createHttpError(403, "You can only delete games you played in.");
    }

    if (game.status === "active") {
      throw createHttpError(
        400,
        "Cannot delete a game in progress. Finish the game, resign, or agree to a draw first.",
      );
    }

    await prisma.userHiddenGame.upsert({
      where: {
        userId_gameId: {
          userId: req.user.id,
          gameId: game.id,
        },
      },
      create: {
        userId: req.user.id,
        gameId: game.id,
      },
      update: {},
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/:id/join", requireAuth, async (req, res, next) => {
  try {
    const game = await prisma.game.findUnique({
      where: { id: req.params.id },
      select: gameSelect,
    });

    if (!game) {
      throw createHttpError(404, "Game not found");
    }

    const alreadyParticipant =
      game.whitePlayerId === req.user.id || game.blackPlayerId === req.user.id;

    if (alreadyParticipant) {
      return res.json({ game: await getGameState(game.id) });
    }

    if (game.status !== "waiting") {
      throw createHttpError(400, "Game is no longer joinable");
    }

    if (game.whitePlayerId && game.blackPlayerId) {
      throw createHttpError(400, "Game already has two players");
    }

    const updated = await prisma.game.update({
      where: { id: game.id },
      data: {
        blackPlayerId: game.whitePlayerId ? req.user.id : game.blackPlayerId,
        status: "active",
        startedAt: new Date(),
      },
      select: gameSelect,
    });

    upsertRuntime(updated);

    const state = await getGameState(updated.id);
    await broadcastGameState(updated.id);

    res.json({ game: state });
  } catch (error) {
    next(error);
  }
});

module.exports = { gameRouter: router };
