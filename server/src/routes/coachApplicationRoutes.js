const { Router } = require("express");
const { z } = require("zod");
const crypto = require("node:crypto");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { createHttpError } = require("../utils/createHttpError");
const {
  sendCoachApplicationAdminEmail,
  sendCoachApplicationReceivedEmail,
  sendCoachApplicationApprovedEmail,
  sendCoachApplicationRejectedEmail,
} = require("../services/emailService");
const { regenerateAvailabilitySlots } = require("../services/coachAvailabilityService");
const { SPECIALIZATION_OPTIONS, CURRENCY_OPTIONS, isValidPhotoUrl } = require("../utils/coachProfileSchema");

const router = Router();

// Step 5 of the wizard: the dates the applicant clicked as available on their monthly
// calendar. There's no recurring weekly pattern — just explicit one-off dates, same model
// CoachDashboardPage uses post-approval (PUT /coach/availability-exceptions).
const availabilityExceptionSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine((entry) => entry.endMinute > entry.startMinute, {
    message: "endMinute must be after startMinute",
  });

// Accepts either a normal http(s) photo URL or a data: URI produced by the client-side
// image resizer (BecomeCoachPage compresses to a standard size before submitting).
const photoUrlSchema = z
  .string()
  .trim()
  .max(2_000_000)
  .refine(isValidPhotoUrl, "Photo must be a valid image URL or upload")
  .optional();

const applySchema = z.object({
  name: z.string().trim().min(1).max(80),
  surname: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  fideId: z.string().trim().min(1).max(20).optional(),
  experienceYears: z.number().int().min(0).max(80),
  bio: z.string().trim().max(2000).optional(),
  photoUrl: photoUrlSchema,
  fideRating: z.number().int().min(0).max(4000).optional(),
  specialties: z.array(z.enum(SPECIALIZATION_OPTIONS)).length(1),
  languages: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
  hourlyRate: z.number().int().min(0).max(100000),
  hourlyRateCurrency: z.enum(CURRENCY_OPTIONS),
  phone: z.string().trim().min(3).max(30),
  whatsapp: z.string().trim().max(30).optional(),
  // Kept in sync with the same-length bump in coachDashboardRoutes.js — 200 was
  // too tight for real wa.me/t.me links carrying a prefilled message or tracking params.
  whatsappLink: z.string().trim().max(500).optional(),
  telegram: z.string().trim().max(60).optional(),
  telegramLink: z.string().trim().max(500).optional(),
  availabilityExceptions: z.array(availabilityExceptionSchema).max(62).default([]),
});

const respondSchema = z.object({
  token: z.string().min(1),
  action: z.enum(["approve", "reject"]),
});

/** A logged-in player applies to become a coach. Blocked if already a coach or already has a pending application. */
router.post("/", requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === "coach") {
      throw createHttpError(400, "You're already a coach");
    }

    const input = applySchema.parse(req.body);

    // A coach applies today, so the earliest lesson slot they can offer is tomorrow — the
    // client already blocks this in the calendar UI, but re-check server-side too.
    const todayKey = new Date().toISOString().slice(0, 10);
    const hasPastOrTodayDate = input.availabilityExceptions.some((entry) => entry.date <= todayKey);
    if (hasPastOrTodayDate) {
      throw createHttpError(400, "Availability dates must start the day after you apply");
    }

    const existingPending = await prisma.coachApplication.findFirst({
      where: { userId: req.user.id, status: "pending" },
      select: { id: true },
    });

    if (existingPending) {
      throw createHttpError(409, "You already have a pending application");
    }

    const responseToken = crypto.randomBytes(24).toString("hex");

    const application = await prisma.coachApplication.create({
      data: { ...input, userId: req.user.id, responseToken },
    });

    sendCoachApplicationAdminEmail({ application, applicant: req.user, responseToken }).catch((error) => {
      console.error("[coachApplicationRoutes] Failed to send admin notification:", error?.message || error);
    });
    sendCoachApplicationReceivedEmail({ applicant: req.user }).catch((error) => {
      console.error("[coachApplicationRoutes] Failed to send applicant confirmation:", error?.message || error);
    });

    res.status(201).json({
      application: {
        id: application.id,
        status: application.status,
        createdAt: application.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/** Site owner's approve/reject click from the notification email — token-gated, no login. */
router.post("/:id/respond", async (req, res, next) => {
  try {
    const { token, action } = respondSchema.parse(req.body ?? {});

    const application = await prisma.coachApplication.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!application || application.responseToken !== token) {
      throw createHttpError(404, "This application link is invalid or has expired");
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    let newCoachId = null;

    const updatedCount = await prisma.$transaction(async (tx) => {
      const { count } = await tx.coachApplication.updateMany({
        where: { id: application.id, status: "pending" },
        data: { status: newStatus, respondedAt: new Date() },
      });

      if (count > 0 && newStatus === "approved") {
        const coach = await tx.coach.create({
          data: {
            userId: application.userId,
            name: application.name,
            surname: application.surname,
            title: application.title,
            fideId: application.fideId,
            experienceYears: application.experienceYears,
            bio: application.bio,
            photoUrl: application.photoUrl,
            fideRating: application.fideRating,
            specialties: application.specialties,
            languages: application.languages,
            hourlyRate: application.hourlyRate,
            hourlyRateCurrency: application.hourlyRateCurrency,
            phone: application.phone,
            whatsapp: application.whatsapp,
            whatsappLink: application.whatsappLink,
            telegram: application.telegram,
            telegramLink: application.telegramLink,
            email: application.user.email,
          },
        });
        newCoachId = coach.id;

        const availabilityExceptions = Array.isArray(application.availabilityExceptions)
          ? application.availabilityExceptions
          : [];
        if (availabilityExceptions.length > 0) {
          await tx.coachAvailabilityException.createMany({
            data: availabilityExceptions.map((entry) => ({
              coachId: coach.id,
              date: new Date(`${entry.date}T00:00:00.000Z`),
              type: "one_off",
              startMinute: entry.startMinute,
              endMinute: entry.endMinute,
            })),
          });
        }

        await tx.user.update({
          where: { id: application.userId },
          data: { role: "coach" },
        });
      }

      return count;
    });

    if (updatedCount === 0) {
      const current = await prisma.coachApplication.findUnique({ where: { id: application.id } });
      return res.json({ application: { id: application.id, status: current.status }, alreadyResponded: true });
    }

    // Materialize the coach's applied-for calendar dates into real bookable CoachAvailability
    // slots. Best-effort — the coach can always regenerate from their dashboard, so a failure
    // here shouldn't fail the approval itself.
    if (newCoachId) {
      regenerateAvailabilitySlots(newCoachId).catch((error) => {
        console.error("[coachApplicationRoutes] Failed to generate initial availability slots:", error?.message || error);
      });
    }

    if (newStatus === "approved") {
      sendCoachApplicationApprovedEmail({ applicant: application.user }).catch((error) => {
        console.error("[coachApplicationRoutes] Failed to send approval email:", error?.message || error);
      });
    } else {
      sendCoachApplicationRejectedEmail({ applicant: application.user }).catch((error) => {
        console.error("[coachApplicationRoutes] Failed to send rejection email:", error?.message || error);
      });
    }

    res.json({ application: { id: application.id, status: newStatus } });
  } catch (error) {
    next(error);
  }
});

module.exports = { coachApplicationRouter: router };
