const { Router } = require("express");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const {
  BOARD_THEME_IDS,
  normalizePreferences,
} = require("../constants/boardThemes");

const router = Router();

const patchPreferencesSchema = z.object({
  boardTheme: z.enum(BOARD_THEME_IDS),
});

router.get("/preferences", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { preferences: true },
    });

    res.json({ preferences: normalizePreferences(user?.preferences) });
  } catch (error) {
    next(error);
  }
});

router.patch("/preferences", requireAuth, async (req, res, next) => {
  try {
    const input = patchPreferencesSchema.parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { preferences: true },
    });

    const current =
      existing?.preferences && typeof existing.preferences === "object" && !Array.isArray(existing.preferences)
        ? existing.preferences
        : {};

    const preferences = normalizePreferences({
      ...current,
      boardTheme: input.boardTheme,
    });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { preferences },
    });

    res.json({ preferences });
  } catch (error) {
    next(error);
  }
});

router.get("/coach-application", requireAuth, async (req, res, next) => {
  try {
    const application = await prisma.coachApplication.findFirst({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true, respondedAt: true },
    });

    res.json({ application });
  } catch (error) {
    next(error);
  }
});

router.get("/coach-bookings", requireAuth, async (req, res, next) => {
  try {
    const bookings = await prisma.coachBooking.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        note: true,
        createdAt: true,
        coach: { select: { id: true, name: true, surname: true, photoUrl: true } },
        slot: { select: { startTime: true, endTime: true } },
      },
    });

    res.json({ bookings });
  } catch (error) {
    next(error);
  }
});

module.exports = { meRouter: router };
