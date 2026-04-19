const bcrypt = require("bcryptjs");
const { Router } = require("express");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { generateUniqueInviteCode } = require("../utils/inviteCode");
const { signAccessToken } = require("../utils/jwt");
const { createHttpError } = require("../utils/createHttpError");

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

function toAuthResponse(user) {
  const token = signAccessToken({ sub: user.id });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      userCode: user.userCode,
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

module.exports = { authRouter: router };
