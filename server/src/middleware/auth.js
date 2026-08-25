const { prisma } = require("../lib/prisma");
const { verifyAccessToken } = require("../utils/jwt");
const { createHttpError } = require("../utils/createHttpError");

async function requireAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      throw createHttpError(401, "Missing authentication token");
    }

    const decoded = verifyAccessToken(token);

    if (!decoded?.sub) {
      throw createHttpError(401, "Invalid authentication token");
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        username: true,
        email: true,
        userCode: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw createHttpError(401, "User not found for token");
    }

    req.user = user;
    next();
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 401;
      error.message = "Invalid or expired authentication token";
    }

    next(error);
  }
}

module.exports = { requireAuth };
