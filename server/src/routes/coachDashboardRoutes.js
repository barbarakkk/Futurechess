const { Router } = require("express");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { createHttpError } = require("../utils/createHttpError");
const { applyBookingResponse } = require("../services/coachBookingService");
const { regenerateAvailabilitySlots } = require("../services/coachAvailabilityService");
const { SPECIALIZATION_OPTIONS, CURRENCY_OPTIONS, isValidPhotoUrl } = require("../utils/coachProfileSchema");

const router = Router();

router.use(requireAuth, requireRole("coach"));

/** Loads the logged-in coach's own Coach row onto req.coach. A coach User always has one, created atomically at approval time. */
async function loadCoach(req, _res, next) {
  try {
    const coach = await prisma.coach.findUnique({ where: { userId: req.user.id } });

    if (!coach) {
      throw createHttpError(404, "No coach profile found for this account");
    }

    req.coach = coach;
    next();
  } catch (error) {
    next(error);
  }
}

router.use(loadCoach);

router.get("/me", (req, res) => {
  res.json({ coach: req.coach });
});

// Optional string field that, unlike the one-time application form, must support being
// *cleared* by an existing coach editing their profile — an omitted/empty value is
// normalized to null below rather than left untouched, so clearing a field actually sticks.
const optionalProfileString = (max) => z.string().trim().max(max).optional().default("");

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  surname: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  fideId: optionalProfileString(20),
  experienceYears: z.number().int().min(0).max(80),
  bio: optionalProfileString(2000),
  photoUrl: optionalProfileString(2_000_000).refine(
    (value) => value === "" || isValidPhotoUrl(value),
    "Photo must be a valid image URL or upload",
  ),
  fideRating: z.number().int().min(0).max(4000).nullable().optional(),
  specialties: z.array(z.enum(SPECIALIZATION_OPTIONS)).length(1),
  languages: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
  hourlyRate: z.number().int().min(0).max(100000),
  hourlyRateCurrency: z.enum(CURRENCY_OPTIONS),
  phone: z.string().trim().min(3).max(30),
  whatsapp: optionalProfileString(30),
  // 200 was too tight for real links — e.g. wa.me/t.me URLs with a prefilled
  // ?text= message, or a pasted URL carrying tracking query params, routinely
  // run past it and got rejected with an opaque "Validation error".
  whatsappLink: optionalProfileString(500),
  telegram: optionalProfileString(60),
  telegramLink: optionalProfileString(500),
});

/** Lets an approved coach edit the profile info they originally submitted in the
 * application wizard (name, bio, rate, contact links, etc.) — everything except
 * email/availability, which have their own dedicated flows. */
router.put("/profile", async (req, res, next) => {
  try {
    const input = updateProfileSchema.parse(req.body);

    const coach = await prisma.coach.update({
      where: { id: req.coach.id },
      data: {
        name: input.name,
        surname: input.surname,
        title: input.title,
        fideId: input.fideId || null,
        experienceYears: input.experienceYears,
        bio: input.bio || null,
        photoUrl: input.photoUrl || null,
        fideRating: input.fideRating ?? null,
        specialties: input.specialties,
        languages: input.languages,
        hourlyRate: input.hourlyRate,
        hourlyRateCurrency: input.hourlyRateCurrency,
        phone: input.phone,
        whatsapp: input.whatsapp || null,
        whatsappLink: input.whatsappLink || null,
        telegram: input.telegram || null,
        telegramLink: input.telegramLink || null,
      },
    });

    res.json({ coach });
  } catch (error) {
    next(error);
  }
});

// Fallback UTC window for the legacy `dates` form of PUT /availability-exceptions. The calendar
// UI now sends per-date hours (see CoachDashboardPage's bulk "hours for selected days" control).
const DEFAULT_ONE_OFF_START_MINUTE = 600; // 10:00
const DEFAULT_ONE_OFF_END_MINUTE = 1080; // 18:00

/** Returns the coach's explicitly-added available dates. There's no recurring weekly
 * pattern — a coach's whole schedule is just this set of one-off dates. */
router.get("/availability-exceptions", async (req, res, next) => {
  try {
    const exceptions = await prisma.coachAvailabilityException.findMany({
      where: { coachId: req.coach.id, type: "one_off" },
      orderBy: { date: "asc" },
      select: { date: true, startMinute: true, endMinute: true },
    });

    res.json({
      exceptions: exceptions.map((exception) => ({
        date: exception.date.toISOString().slice(0, 10),
        startMinute: exception.startMinute,
        endMinute: exception.endMinute,
      })),
    });
  } catch (error) {
    next(error);
  }
});

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const exceptionEntrySchema = z
  .object({
    date: dateOnlySchema,
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine((entry) => entry.endMinute > entry.startMinute, {
    message: "endMinute must be after startMinute",
  });
// `exceptions` carries per-date hours (bulk-applied from the calendar UI); bare `dates` is the
// older whole-day form and gets the default window.
const putExceptionsSchema = z
  .object({
    exceptions: z.array(exceptionEntrySchema).max(120).optional(),
    dates: z.array(dateOnlySchema).max(120).optional(),
  })
  .refine((body) => body.exceptions || body.dates, { message: "Expected exceptions or dates" });

/** Replaces the coach's full set of available dates (each with its own hours), then additively
 * generates the matching future slots. */
router.put("/availability-exceptions", async (req, res, next) => {
  try {
    const body = putExceptionsSchema.parse(req.body);
    const entries =
      body.exceptions ??
      body.dates.map((date) => ({
        date,
        startMinute: DEFAULT_ONE_OFF_START_MINUTE,
        endMinute: DEFAULT_ONE_OFF_END_MINUTE,
      }));

    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const parsedEntries = entries.map((entry) => {
      const parsed = new Date(`${entry.date}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime())) {
        throw createHttpError(400, `Invalid date: ${entry.date}`);
      }
      if (parsed < startOfToday) {
        throw createHttpError(400, `Date is in the past: ${entry.date}`);
      }
      return { date: parsed, startMinute: entry.startMinute, endMinute: entry.endMinute };
    });
    const parsedDates = parsedEntries.map((entry) => entry.date);

    const previous = await prisma.coachAvailabilityException.findMany({
      where: { coachId: req.coach.id, type: "one_off", date: { in: parsedDates } },
      select: { date: true, startMinute: true, endMinute: true },
    });
    const previousByDate = new Map(previous.map((row) => [row.date.toISOString(), row]));
    const changedEntries = parsedEntries.filter((entry) => {
      const before = previousByDate.get(entry.date.toISOString());
      return before && (before.startMinute !== entry.startMinute || before.endMinute !== entry.endMinute);
    });

    await prisma.$transaction([
      prisma.coachAvailabilityException.deleteMany({
        where: { coachId: req.coach.id, type: "one_off", date: { notIn: parsedDates } },
      }),
      // Slot generation is additive, so when a date's hours change the old slots would linger.
      // Clear only the future slots on those dates that nobody has ever requested — a slot with
      // any booking (even a declined one) is kept, since its history hangs off it.
      ...changedEntries.map((entry) =>
        prisma.coachAvailability.deleteMany({
          where: {
            coachId: req.coach.id,
            isBooked: false,
            bookings: { none: {} },
            startTime: {
              gt: now,
              gte: entry.date,
              lt: new Date(entry.date.getTime() + 24 * 60 * 60_000),
            },
          },
        }),
      ),
      ...parsedEntries.map((entry) =>
        prisma.coachAvailabilityException.upsert({
          where: { coachId_date: { coachId: req.coach.id, date: entry.date } },
          update: { type: "one_off", startMinute: entry.startMinute, endMinute: entry.endMinute },
          create: {
            coachId: req.coach.id,
            date: entry.date,
            type: "one_off",
            startMinute: entry.startMinute,
            endMinute: entry.endMinute,
          },
        }),
      ),
    ]);

    const { created } = await regenerateAvailabilitySlots(req.coach.id);

    const saved = await prisma.coachAvailabilityException.findMany({
      where: { coachId: req.coach.id, type: "one_off" },
      orderBy: { date: "asc" },
      select: { date: true, startMinute: true, endMinute: true },
    });

    res.json({
      dates: saved.map((exception) => exception.date.toISOString().slice(0, 10)),
      exceptions: saved.map((exception) => ({
        date: exception.date.toISOString().slice(0, 10),
        startMinute: exception.startMinute,
        endMinute: exception.endMinute,
      })),
      slotsCreated: created,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/bookings", async (req, res, next) => {
  try {
    const bookings = await prisma.coachBooking.findMany({
      where: { coachId: req.coach.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        note: true,
        createdAt: true,
        user: { select: { id: true, username: true } },
        slot: { select: { startTime: true, endTime: true } },
      },
    });

    res.json({ bookings });
  } catch (error) {
    next(error);
  }
});

const respondSchema = z.object({ action: z.enum(["accept", "decline"]) });

/** Authenticated equivalent of the emailed token link — same underlying atomic flip via applyBookingResponse. */
router.post("/bookings/:id/respond", async (req, res, next) => {
  try {
    const { action } = respondSchema.parse(req.body ?? {});

    const booking = await prisma.coachBooking.findFirst({
      where: { id: req.params.id, coachId: req.coach.id },
    });

    if (!booking) {
      throw createHttpError(404, "Booking not found");
    }

    const updatedCount = await applyBookingResponse({
      bookingId: booking.id,
      slotId: booking.slotId,
      action,
    });

    if (updatedCount === 0) {
      const current = await prisma.coachBooking.findUnique({ where: { id: booking.id } });
      return res.json({ booking: { id: booking.id, status: current.status }, alreadyResponded: true });
    }

    res.json({ booking: { id: booking.id, status: action === "accept" ? "confirmed" : "declined" } });
  } catch (error) {
    next(error);
  }
});

module.exports = { coachDashboardRouter: router };
