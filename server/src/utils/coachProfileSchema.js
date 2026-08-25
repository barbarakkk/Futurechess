// Shared between coachApplicationRoutes.js (one-time application) and coachDashboardRoutes.js
// (editing an existing profile) — keep these value lists in sync with
// SPECIALIZATION_OPTIONS/CURRENCY_OPTIONS/LANGUAGE_OPTIONS in
// client/src/lib/coachProfileOptions.ts.

const SPECIALIZATION_OPTIONS = ["Coach", "Sparring partner", "Coach / Sparring partner"];
const CURRENCY_OPTIONS = ["USD", "GEL", "EUR"];

const PHOTO_HTTP_URL_PATTERN = /^https?:\/\//i;
const PHOTO_DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp);base64,/i;

/** Accepts either a normal http(s) photo URL or a data: URI produced by the client-side
 * image resizer (both BecomeCoachPage and CoachDashboardPage compress to a standard size
 * before submitting). */
function isValidPhotoUrl(value) {
  return PHOTO_HTTP_URL_PATTERN.test(value) || PHOTO_DATA_URL_PATTERN.test(value);
}

module.exports = { SPECIALIZATION_OPTIONS, CURRENCY_OPTIONS, isValidPhotoUrl };
