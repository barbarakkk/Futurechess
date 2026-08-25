const { Resend } = require("resend");

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_ADDRESS = process.env.EMAIL_FROM || "FutureChess <onboarding@resend.dev>";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

/** Low-level send — logs and no-ops instead of throwing when no provider key is configured, so booking flows never fail because email isn't set up yet. */
async function sendEmail({ to, subject, html }) {
  if (!resend) {
    console.warn(`[emailService] RESEND_API_KEY not set — skipping email to ${to}: "${subject}"`);
    return { skipped: true };
  }

  try {
    return await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
  } catch (error) {
    console.error(`[emailService] Failed to send email to ${to}:`, error?.message || error);
    return { skipped: true, error };
  }
}

/** Escapes text before it's interpolated into an HTML email — untrusted values (usernames) must never be inserted raw. */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatSlotTime(startTime, endTime) {
  const format = (date) =>
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(date)) + " UTC";

  return `${format(startTime)} – ${format(endTime)}`;
}

/** Notifies a coach of a new pending booking, with tokenized accept/decline links they can click without logging in. */
async function sendCoachBookingRequestEmail({ coach, player, slot, note, responseToken, bookingId }) {
  const acceptUrl = `${CLIENT_URL}/coach-bookings/respond?id=${bookingId}&token=${responseToken}&action=accept`;
  const declineUrl = `${CLIENT_URL}/coach-bookings/respond?id=${bookingId}&token=${responseToken}&action=decline`;
  const when = formatSlotTime(slot.startTime, slot.endTime);
  const safeCoachName = escapeHtml(coach.name);
  const safePlayerName = escapeHtml(player.username);
  const noteHtml = note
    ? `<p><strong>Note from ${safePlayerName}:</strong> ${escapeHtml(note)}</p>`
    : "";

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>New session request</h2>
      <p>Hi ${safeCoachName}, <strong>${safePlayerName}</strong> would like to book a session with you on FutureChess.</p>
      <p><strong>When:</strong> ${when}</p>
      ${noteHtml}
      <p style="margin-top: 24px;">
        <a href="${acceptUrl}" style="background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-right:12px;">Accept</a>
        <a href="${declineUrl}" style="background:#dc2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Decline</a>
      </p>
      <p style="color:#666;font-size:13px;margin-top:24px;">You can respond directly from this email, or from your Coach Dashboard if you're logged in — no account required to use the links.</p>
    </div>
  `;

  return sendEmail({
    to: coach.email,
    subject: `New session request from ${safePlayerName}`,
    html,
  });
}

/** Notifies the site owner (ADMIN_EMAIL) of a new coach application, with tokenized approve/reject links. No-ops with a console warning if ADMIN_EMAIL isn't set. */
async function sendCoachApplicationAdminEmail({ application, applicant, responseToken }) {
  if (!ADMIN_EMAIL) {
    console.warn("[emailService] ADMIN_EMAIL not set — skipping coach application notification");
    return { skipped: true };
  }

  const approveUrl = `${CLIENT_URL}/coach-applications/respond?id=${application.id}&token=${responseToken}&action=approve`;
  const rejectUrl = `${CLIENT_URL}/coach-applications/respond?id=${application.id}&token=${responseToken}&action=reject`;
  const safeApplicantName = escapeHtml(applicant.username);
  const safeName = escapeHtml(`${application.name} ${application.surname}`);
  const safeTitle = escapeHtml(application.title);
  const safeBio = application.bio ? escapeHtml(application.bio) : "";
  const safePhone = escapeHtml(application.phone);
  const safeWhatsapp = application.whatsapp ? escapeHtml(application.whatsapp) : "";
  const safeWhatsappLink = application.whatsappLink ? escapeHtml(application.whatsappLink) : "";
  const safeTelegram = application.telegram ? escapeHtml(application.telegram) : "";
  const safeTelegramLink = application.telegramLink ? escapeHtml(application.telegramLink) : "";
  const safeFideId = application.fideId ? escapeHtml(application.fideId) : "";
  const safeRate =
    application.hourlyRate != null
      ? escapeHtml(`${application.hourlyRate} ${application.hourlyRateCurrency || ""}`.trim())
      : "";

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>New coach application</h2>
      <p><strong>${safeApplicantName}</strong> (account) applied to become a coach as <strong>${safeName}</strong>.</p>
      <p><strong>Title:</strong> ${safeTitle}</p>
      ${safeFideId ? `<p><strong>FIDE ID:</strong> ${safeFideId}</p>` : ""}
      <p><strong>Experience:</strong> ${application.experienceYears} years</p>
      ${safeRate ? `<p><strong>Hourly rate:</strong> ${safeRate}</p>` : ""}
      <p><strong>Phone:</strong> ${safePhone}</p>
      ${safeWhatsapp ? `<p><strong>WhatsApp:</strong> ${safeWhatsapp}</p>` : ""}
      ${safeWhatsappLink ? `<p><strong>WhatsApp link:</strong> ${safeWhatsappLink}</p>` : ""}
      ${safeTelegram ? `<p><strong>Telegram:</strong> ${safeTelegram}</p>` : ""}
      ${safeTelegramLink ? `<p><strong>Telegram link:</strong> ${safeTelegramLink}</p>` : ""}
      ${safeBio ? `<p><strong>Bio:</strong> ${safeBio}</p>` : ""}
      <p style="margin-top: 24px;">
        <a href="${approveUrl}" style="background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-right:12px;">Approve</a>
        <a href="${rejectUrl}" style="background:#dc2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Reject</a>
      </p>
    </div>
  `;

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `New coach application from ${safeApplicantName}`,
    html,
  });
}

/** Confirms receipt of a coach application to the applicant. */
async function sendCoachApplicationReceivedEmail({ applicant }) {
  const safeName = escapeHtml(applicant.username);
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Application received</h2>
      <p>Hi ${safeName}, thanks for applying to coach on FutureChess. We'll review your application and email you with a decision.</p>
    </div>
  `;

  return sendEmail({ to: applicant.email, subject: "Your FutureChess coach application was received", html });
}

/** Tells the applicant their coach application was approved, with a link back through login (so their session picks up the new role). */
async function sendCoachApplicationApprovedEmail({ applicant }) {
  const safeName = escapeHtml(applicant.username);
  const dashboardUrl = `${CLIENT_URL}/login?redirect=/coach/dashboard`;
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>You're approved!</h2>
      <p>Congrats ${safeName} — your FutureChess coach application was approved. Log back in to set up your availability and start accepting sessions.</p>
      <p style="margin-top: 24px;">
        <a href="${dashboardUrl}" style="background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Go to Coach Dashboard</a>
      </p>
    </div>
  `;

  return sendEmail({ to: applicant.email, subject: "Your FutureChess coach application was approved", html });
}

/** Tells the applicant their coach application was rejected. */
async function sendCoachApplicationRejectedEmail({ applicant }) {
  const safeName = escapeHtml(applicant.username);
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Application update</h2>
      <p>Hi ${safeName}, thanks for your interest in coaching on FutureChess. We're not able to approve your application at this time. You're welcome to apply again in the future.</p>
    </div>
  `;

  return sendEmail({ to: applicant.email, subject: "Your FutureChess coach application", html });
}

/** Emails a password-reset link built from the RAW token — the DB only ever holds a hash of it. */
async function sendPasswordResetEmail({ user, rawToken }) {
  const resetUrl = `${CLIENT_URL}/reset-password?token=${rawToken}`;
  const safeUsername = escapeHtml(user.username);

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Reset your password</h2>
      <p>Hi ${safeUsername}, we received a request to reset your ChessHub password. This link expires in 1 hour.</p>
      <p style="margin-top: 24px;">
        <a href="${resetUrl}" style="background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Reset password</a>
      </p>
      <p style="color:#666;font-size:13px;margin-top:24px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    </div>
  `;

  return sendEmail({ to: user.email, subject: "Reset your ChessHub password", html });
}

module.exports = {
  sendEmail,
  sendCoachBookingRequestEmail,
  sendCoachApplicationAdminEmail,
  sendCoachApplicationReceivedEmail,
  sendCoachApplicationApprovedEmail,
  sendCoachApplicationRejectedEmail,
  sendPasswordResetEmail,
};
