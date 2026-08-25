const { prisma } = require("../lib/prisma");

/**
 * Atomically flips a pending booking to confirmed/declined, reopening the slot on decline.
 * Shared by the token-gated email-link route (coachBookingRoutes.js) and the authenticated
 * coach-dashboard route (coachDashboardRoutes.js) so the "first response wins" logic only
 * lives in one place.
 *
 * Returns the number of rows updated (0 means someone else already responded — a race, not
 * an error; callers should treat 0 as "already responded").
 */
async function applyBookingResponse({ bookingId, slotId, action }) {
  const newStatus = action === "accept" ? "confirmed" : "declined";

  return prisma.$transaction(async (tx) => {
    const { count } = await tx.coachBooking.updateMany({
      where: { id: bookingId, status: "pending" },
      data: { status: newStatus },
    });

    if (count > 0 && newStatus === "declined") {
      await tx.coachAvailability.update({
        where: { id: slotId },
        data: { isBooked: false },
      });
    }

    return count;
  });
}

module.exports = { applyBookingResponse };
