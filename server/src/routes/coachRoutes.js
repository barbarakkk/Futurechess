const { Router } = require("express");
const { z } = require("zod");
const crypto = require("node:crypto");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { createHttpError } = require("../utils/createHttpError");
const { sendCoachBookingRequestEmail } = require("../services/emailService");

const router = Router();

const coachPublicSelect = {
  id: true,
  name: true,
  surname: true,
  title: true,
  experienceYears: true,
  bio: true,
  photoUrl: true,
  fideRating: true,
  specialties: true,
  languages: true,
  hourlyRate: true,
  hourlyRateCurrency: true,
};

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const coaches = await prisma.coach.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: coachPublicSelect,
    });

    res.json({ coaches });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const coach = await prisma.coach.findFirst({
      where: { id: req.params.id, isActive: true },
      select: {
        ...coachPublicSelect,
        availability: {
          where: {
            isBooked: false,
            startTime: { gte: new Date() },
          },
          orderBy: { startTime: "asc" },
          select: { id: true, startTime: true, endTime: true },
        },
      },
    });

    if (!coach) {
      throw createHttpError(404, "Coach not found");
    }

    res.json({ coach });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/slots/:slotId/book", requireAuth, async (req, res, next) => {
  try {
    const { id: coachId, slotId } = z
      .object({ id: z.string().min(1), slotId: z.string().min(1) })
      .parse(req.params);
    const { note } = z
      .object({ note: z.string().trim().max(500).optional() })
      .parse(req.body ?? {});

    const coach = await prisma.coach.findFirst({
      where: { id: coachId, isActive: true },
      select: { id: true, name: true, email: true },
    });

    if (!coach) {
      throw createHttpError(404, "Coach not found");
    }

    const slot = await prisma.coachAvailability.findFirst({
      where: { id: slotId, coachId, startTime: { gte: new Date() } },
    });

    if (!slot) {
      throw createHttpError(404, "Slot not found");
    }

    const responseToken = crypto.randomBytes(24).toString("hex");

    const booking = await prisma.$transaction(async (tx) => {
      const claim = await tx.coachAvailability.updateMany({
        where: { id: slotId, isBooked: false },
        data: { isBooked: true },
      });

      if (claim.count !== 1) {
        throw createHttpError(409, "This slot was just booked by someone else");
      }

      return tx.coachBooking.create({
        data: {
          slotId,
          coachId,
          userId: req.user.id,
          note: note || null,
          responseToken,
        },
      });
    });

    sendCoachBookingRequestEmail({
      coach,
      player: req.user,
      slot,
      note: booking.note,
      responseToken,
      bookingId: booking.id,
    }).catch((error) => {
      console.error("[coachRoutes] Failed to send coach booking email:", error?.message || error);
    });

    res.status(201).json({
      booking: {
        id: booking.id,
        status: booking.status,
        coachId: booking.coachId,
        note: booking.note,
        slot: { id: slot.id, startTime: slot.startTime, endTime: slot.endTime },
        createdAt: booking.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = { coachRouter: router };
