const { prisma } = require("../lib/prisma");

// How far ahead an exception date is materialized into concrete bookable slots.
const GENERATION_WINDOW_DAYS = 28;
const SLOT_DURATION_MINUTES = 60;

function dateKeyUTC(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Expands a coach's explicitly-added availability dates (`CoachAvailabilityException`) into
 * concrete `CoachAvailability` rows for the next GENERATION_WINDOW_DAYS days (all times UTC).
 * There is no recurring weekly pattern — a coach's schedule is just the set of dates they've
 * clicked on in their monthly calendar (wizard step 5, or CoachDashboardPage post-approval).
 *
 * Additive only — never deletes or edits existing rows. This is a deliberate tradeoff
 * (see coach-selfservice.prd §1): a slot can have a *declined* booking's history hanging
 * off it via cascade, so deleting an "unmatched" unbooked slot could silently erase a
 * player's booking history. If a coach removes a date from their calendar after slots for
 * it already exist, already-generated future slots stay bookable until they age into the
 * past — this only affects what gets generated going forward.
 */
async function regenerateAvailabilitySlots(coachId) {
  const now = new Date();
  // Exceptions are stored as bare DATE (midnight UTC) — compare against start-of-today,
  // not `now` itself, or today's own exception would be excluded once the clock passes midnight.
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const windowEnd = new Date(startOfToday.getTime() + GENERATION_WINDOW_DAYS * 24 * 60 * 60_000);

  const [exceptions, existingSlots] = await Promise.all([
    prisma.coachAvailabilityException.findMany({
      where: { coachId, date: { gte: startOfToday, lte: windowEnd } },
    }),
    prisma.coachAvailability.findMany({
      where: { coachId, startTime: { gte: now } },
      select: { startTime: true },
    }),
  ]);

  if (exceptions.length === 0) {
    return { created: 0 };
  }

  const existingKeys = new Set(existingSlots.map((slot) => slot.startTime.toISOString()));
  const toCreate = [];

  for (const exception of exceptions) {
    if (exception.startMinute == null || exception.endMinute == null) {
      continue;
    }

    const day = new Date(`${dateKeyUTC(exception.date)}T00:00:00.000Z`);

    for (
      let chunkStart = exception.startMinute;
      chunkStart + SLOT_DURATION_MINUTES <= exception.endMinute;
      chunkStart += SLOT_DURATION_MINUTES
    ) {
      const startTime = new Date(day.getTime() + chunkStart * 60_000);
      const endTime = new Date(startTime.getTime() + SLOT_DURATION_MINUTES * 60_000);

      if (startTime <= now) {
        continue;
      }

      const key = startTime.toISOString();
      if (existingKeys.has(key)) {
        continue;
      }

      existingKeys.add(key); // guards against duplicate slots if this ever runs twice in one pass
      toCreate.push({ coachId, startTime, endTime });
    }
  }

  if (toCreate.length > 0) {
    await prisma.coachAvailability.createMany({ data: toCreate });
  }

  return { created: toCreate.length };
}

module.exports = { regenerateAvailabilitySlots, GENERATION_WINDOW_DAYS };
