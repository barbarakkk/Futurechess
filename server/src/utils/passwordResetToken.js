const crypto = require("node:crypto");

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/** SHA-256 of the raw token — this, never the raw token, is what's persisted so a DB
 * read alone can't be used to reset an account's password. */
function hashResetToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/** Generates a fresh single-use reset token: the raw value (emailed to the user, never
 * stored) plus its hash and expiry (stored on the User row). */
function generatePasswordResetToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");

  return {
    rawToken,
    tokenHash: hashResetToken(rawToken),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  };
}

module.exports = { generatePasswordResetToken, hashResetToken, RESET_TOKEN_TTL_MS };
