// Shared between BecomeCoachPage (application wizard) and CoachDashboardPage (profile
// editing) — keep the value lists in sync with SPECIALIZATION_OPTIONS/CURRENCY_OPTIONS in
// server/src/routes/coachApplicationRoutes.js and coachDashboardRoutes.js.

export const SPECIALIZATION_VALUES = ["Coach", "Sparring partner", "Coach / Sparring partner"] as const;
export type SpecializationValue = (typeof SPECIALIZATION_VALUES)[number];

// labelKey is relative to each page's own i18n namespace/section — BecomeCoachPage nests
// these under "form.", CoachDashboardPage nests them under "profile.", so callers must
// prepend their own prefix (e.g. `t(\`form.${option.labelKey}\`)`) rather than passing
// this straight into t().
export const SPECIALIZATION_OPTIONS: { value: SpecializationValue; labelKey: string }[] = [
  { value: "Coach", labelKey: "specializationOptions.coach" },
  { value: "Sparring partner", labelKey: "specializationOptions.sparringPartner" },
  { value: "Coach / Sparring partner", labelKey: "specializationOptions.coachSparringPartner" },
];

export const CURRENCY_VALUES = ["USD", "GEL", "EUR"] as const;
export type CurrencyValue = (typeof CURRENCY_VALUES)[number];

export const CURRENCY_OPTIONS: { value: CurrencyValue; label: string }[] = [
  { value: "USD", label: "$ USD" },
  { value: "GEL", label: "₾ GEL" },
  { value: "EUR", label: "€ EUR" },
];

export const LANGUAGE_OPTIONS: { value: string; labelKey: string }[] = [
  { value: "Georgian", labelKey: "languageOptions.georgian" },
  { value: "English", labelKey: "languageOptions.english" },
  { value: "Russian", labelKey: "languageOptions.russian" },
  { value: "German", labelKey: "languageOptions.german" },
  { value: "French", labelKey: "languageOptions.french" },
  { value: "Spanish", labelKey: "languageOptions.spanish" },
  { value: "Turkish", labelKey: "languageOptions.turkish" },
  { value: "Armenian", labelKey: "languageOptions.armenian" },
  { value: "Ukrainian", labelKey: "languageOptions.ukrainian" },
];
