const { Router } = require("express");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { createHttpError } = require("../utils/createHttpError");
const { applyBookingResponse } = require("../services/coachBookingService");

const router = Router();

const respondSchema = z.object({
  token: z.string().min(1),
  action: z.enum(["accept", "decline"]),
});

/** Coach's accept/decline click, verified by a per-booking secret token — no login required. */
router.post("/:id/respond", async (req, res, next) => {
  try {
    const { token, action } = respondSchema.parse(req.body ?? {});

    const booking = await prisma.coachBooking.findUnique({
      where: { id: req.params.id },
    });

    if (!booking || booking.responseToken !== token) {
      throw createHttpError(404, "This booking link is invalid or has expired");
    }

    const newStatus = action === "accept" ? "confirmed" : "declined";

    // Conditional update on status: "pending" makes this atomic — if two responses
    // (e.g. a double-click, or accept+decline both firing, or a dashboard click racing
    // this email link) race, only the first wins.
    const updatedCount = await applyBookingResponse({ bookingId: booking.id, slotId: booking.slotId, action });

    if (updatedCount === 0) {
      const current = await prisma.coachBooking.findUnique({ where: { id: booking.id } });
      return res.json({ booking: { id: booking.id, status: current.status }, alreadyResponded: true });
    }

    res.json({ booking: { id: booking.id, status: newStatus } });
  } catch (error) {
    next(error);
  }
});

module.exports = { coachBookingRouter: router };
