const bcrypt = require("bcryptjs");
const { Router } = require("express");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { generateUniqueInviteCode } = require("../utils/inviteCode");
const { signAccessToken } = require("../utils/jwt");
const { createHttpError } = require("../utils/createHttpError");
const { generatePasswordResetToken, hashResetToken } = require("../utils/passwordResetToken");
const { sendPasswordResetEmail } = require("../services/emailService");

const router = Router();

const registerSchema = z.object({
  username: z.string().trim().min(3).max(24),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(72),
});

function toAuthResponse(user) {
  const token = signAccessToken({ sub: user.id });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      userCode: user.userCode,
      role: user.role,
      createdAt: user.createdAt,
    },
  };
}

router.post("/register", async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: input.email }, { username: input.username }],
      },
      select: { id: true, email: true, username: true },
    });

    if (existingUser) {
      throw createHttpError(409, "Email or username already in use");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const userCode = await generateUniqueInviteCode(prisma);

    const user = await prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        passwordHash,
        userCode,
      },
      select: {
        id: true,
        username: true,
        email: true,
        userCode: true,
        role: true,
        createdAt: true,
      },
    });

    res.status(201).json(toAuthResponse(user));
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw createHttpError(401, "Invalid email or password");
    }

    const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);

    if (!passwordMatch) {
      throw createHttpError(401, "Invalid email or password");
    }

    res.json(
      toAuthResponse({
        id: user.id,
        username: user.username,
        email: user.email,
        userCode: user.userCode,
        role: user.role,
        createdAt: user.createdAt,
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Generic response used by /forgot-password whether or not the email is registered —
// the message text must never differ, or the endpoint becomes an email-enumeration oracle.
const FORGOT_PASSWORD_MESSAGE = "If that email is registered, we've sent a password reset link.";

/** Public, tokenized-link flow (same mental model as coach-booking responses): issues a
 * single-use, 1-hour reset token, stores only its hash, and emails the raw token as a link. */
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const { rawToken, tokenHash, expiresAt } = generatePasswordResetToken();

      await prisma.user.update({
        where: { id: user.id },
        data: { resetTokenHash: tokenHash, resetTokenExpiry: expiresAt },
      });

      sendPasswordResetEmail({ user, rawToken }).catch((error) => {
        console.error("[authRoutes] Failed to send password reset email:", error?.message || error);
      });
    }

    res.json({ message: FORGOT_PASSWORD_MESSAGE });
  } catch (error) {
    next(error);
  }
});

/** Public: verifies the token by hashing the incoming raw value and comparing, checks
 * expiry, updates the password, and invalidates the token so the link can't be reused. */
router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const tokenHash = hashResetToken(token);

    const user = await prisma.user.findUnique({ where: { resetTokenHash: tokenHash } });

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      throw createHttpError(400, "This password reset link is invalid or has expired");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetTokenHash: null, resetTokenExpiry: null },
    });

    res.json({ message: "Your password has been reset. You can now log in." });
  } catch (error) {
    next(error);
  }
});

module.exports = { authRouter: router };
