function randomInviteSegment(length = 4) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = "";

  for (let i = 0; i < length; i += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return value;
}

function buildInviteCode() {
  return `FC-${randomInviteSegment(4)}`;
}

async function generateUniqueInviteCode(prisma, maxAttempts = 25) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = buildInviteCode();
    const existingUser = await prisma.user.findUnique({
      where: { userCode: candidate },
      select: { id: true },
    });

    if (!existingUser) return candidate;
  }

  throw new Error("Failed to generate a unique invite code");
}

module.exports = {
  buildInviteCode,
  generateUniqueInviteCode,
};
