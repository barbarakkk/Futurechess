import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, GraduationCap, Upload, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  CoachAvailabilityStep,
  createDefaultAvailabilityValue,
  type AvailabilityStepValue,
} from "../components/CoachAvailabilityStep";
import { api } from "../lib/api";
import {
  CURRENCY_OPTIONS,
  LANGUAGE_OPTIONS,
  SPECIALIZATION_OPTIONS,
  type CurrencyValue,
  type SpecializationValue,
} from "../lib/coachProfileOptions";
import { resizeImageToDataUrl } from "../lib/coachPhoto";
import { getApiErrorMessage } from "../lib/errors";
import { useAuthStore } from "../store/authStore";

type Application = {
  id: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

const STEPS = [
  { key: "about", labelKey: "form.wizard.steps.about" },
  { key: "contact", labelKey: "form.wizard.steps.contact" },
  { key: "profile", labelKey: "form.wizard.steps.profile" },
  { key: "pricing", labelKey: "form.wizard.steps.pricing" },
  { key: "availability", labelKey: "form.wizard.steps.availability" },
] as const;

type ApplicationForm = {
  name: string;
  surname: string;
  title: string;
  fideId: string;
  experienceYears: string;
  bio: string;
  photoDataUrl: string;
  fideRating: string;
  specialization: SpecializationValue | "";
  languages: string[];
  hourlyRate: string;
  hourlyRateCurrency: CurrencyValue;
  phone: string;
  whatsapp: string;
  whatsappLink: string;
  telegram: string;
  telegramLink: string;
  availability: AvailabilityStepValue;
};

const emptyForm: ApplicationForm = {
  name: "",
  surname: "",
  title: "",
  fideId: "",
  experienceYears: "",
  bio: "",
  photoDataUrl: "",
  fideRating: "",
  specialization: "",
  languages: [],
  hourlyRate: "",
  hourlyRateCurrency: "GEL",
  phone: "",
  whatsapp: "",
  whatsappLink: "",
  telegram: "",
  telegramLink: "",
  availability: createDefaultAvailabilityValue(),
};

function toOptionalInt(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : undefined;
}

export function BecomeCoachPage() {
  const { t } = useTranslation("becomeCoach");
  const user = useAuthStore((state) => state.user);
  const [application, setApplication] = useState<Application | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState<ApplicationForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [languagesOpen, setLanguagesOpen] = useState(false);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const languagesMenuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get("/me/coach-application");
      setApplication(response.data.application);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!languagesOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (languagesMenuRef.current && !languagesMenuRef.current.contains(event.target as Node)) {
        setLanguagesOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [languagesOpen]);

  if (user?.role === "coach") {
    return <Navigate to="/coach/dashboard" replace />;
  }

  function validateStep(step: number): string {
    if (step === 0) {
      if (!form.name.trim() || !form.surname.trim() || !form.title.trim() || form.experienceYears.trim() === "") {
        return t("form.wizard.stepIncompleteError");
      }
    } else if (step === 1) {
      if (!form.phone.trim()) {
        return t("form.wizard.stepIncompleteError");
      }
    } else if (step === 2) {
      if (!form.specialization) {
        return t("form.wizard.stepIncompleteError");
      }
      if (form.languages.length === 0) {
        return t("form.languagesRequiredError");
      }
    } else if (step === 3) {
      if (form.hourlyRate.trim() === "") {
        return t("form.wizard.stepIncompleteError");
      }
    }
    return "";
  }

  function handleNext() {
    const message = validateStep(currentStep);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  function handleBack() {
    setError("");
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }

  function toggleLanguage(language: string) {
    setForm((prev) => ({
      ...prev,
      languages: prev.languages.includes(language)
        ? prev.languages.filter((item) => item !== language)
        : [...prev.languages, language],
    }));
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(t("form.photoInvalidType"));
      return;
    }

    setPhotoBusy(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setForm((prev) => ({ ...prev, photoDataUrl: dataUrl }));
      setError("");
    } catch {
      setError(t("form.photoResizeError"));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function submitApplication() {
    if (currentStep !== STEPS.length - 1) {
      return;
    }

    const message = validateStep(3) || validateStep(2) || validateStep(1) || validateStep(0);
    if (message) {
      setError(message);
      return;
    }

    setSubmitting(true);
    setError("");

    const availabilityExceptions = Object.entries(form.availability.exceptions).map(([date, exception]) => ({
      date,
      startMinute: exception.startMinute,
      endMinute: exception.endMinute,
    }));

    try {
      const response = await api.post("/coach-applications", {
        name: form.name.trim(),
        surname: form.surname.trim(),
        title: form.title.trim(),
        fideId: form.fideId.trim() || undefined,
        experienceYears: Number(form.experienceYears),
        bio: form.bio.trim() || undefined,
        photoUrl: form.photoDataUrl || undefined,
        fideRating: toOptionalInt(form.fideRating),
        specialties: form.specialization ? [form.specialization] : [],
        languages: form.languages,
        hourlyRate: Number(form.hourlyRate),
        hourlyRateCurrency: form.hourlyRateCurrency,
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim() || undefined,
        whatsappLink: form.whatsappLink.trim() || undefined,
        telegram: form.telegram.trim() || undefined,
        telegramLink: form.telegramLink.trim() || undefined,
        availabilityExceptions,
      });
      setApplication(response.data.application);
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, t("form.submitError")));
    } finally {
      setSubmitting(false);
    }
  }

  const showForm = application === null || application?.status === "rejected";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <GraduationCap className="h-3.5 w-3.5 text-primary" aria-hidden />
          {t("badge")}
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      {application === undefined && !loadError ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : null}

      {loadError ? (
        <p className="text-sm text-red-600" role="alert">
          {t("loadError")}
        </p>
      ) : null}

      {application?.status === "pending" ? (
        <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-6 text-sm text-muted-foreground">{t("pending.body")}</CardContent>
        </Card>
      ) : null}

      {application?.status === "rejected" ? (
        <p className="text-sm text-muted-foreground">{t("rejected.body")}</p>
      ) : null}

      {application?.status === "approved" ? (
        <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-6 text-sm text-muted-foreground">{t("approved.body")}</CardContent>
        </Card>
      ) : null}

      {showForm ? (
        <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">{t("form.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex items-center">
              {STEPS.map((step, index) => (
                <div key={step.key} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${
                        index < currentStep
                          ? "bg-primary text-primary-foreground"
                          : index === currentStep
                            ? "border-2 border-primary text-primary"
                            : "border border-border text-muted-foreground"
                      }`}
                    >
                      {index < currentStep ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
                    </span>
                    <span
                      className={`hidden text-xs font-medium sm:block ${
                        index === currentStep ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {t(step.labelKey)}
                    </span>
                  </div>
                  {index < STEPS.length - 1 ? (
                    <div className={`mx-2 h-0.5 flex-1 ${index < currentStep ? "bg-primary" : "bg-border"}`} />
                  ) : null}
                </div>
              ))}
            </div>

            <p className="mb-4 text-sm font-medium text-foreground sm:hidden">
              {t("form.wizard.stepCounter", { current: currentStep + 1, total: STEPS.length })} ·{" "}
              {t(STEPS[currentStep].labelKey)}
            </p>

            {/* Never a native submit — Next/Submit are both type="button" and call their
                handlers directly (see submitApplication). A button whose `type` flips
                between "button" and "submit" on the same click that causes the flip fires
                the browser's native submit as a side effect of that click (the type change
                lands before the click's default-action phase), which was skipping straight
                past the availability step to a submitted application. */}
            <form onSubmit={(event) => event.preventDefault()} className="space-y-4">
              {currentStep === 0 ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="coach-app-name" className="text-sm font-medium">
                        {t("form.name")}
                      </label>
                      <Input
                        id="coach-app-name"
                        required
                        value={form.name}
                        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="coach-app-surname" className="text-sm font-medium">
                        {t("form.surname")}
                      </label>
                      <Input
                        id="coach-app-surname"
                        required
                        value={form.surname}
                        onChange={(event) => setForm((prev) => ({ ...prev, surname: event.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="coach-app-title" className="text-sm font-medium">
                        {t("form.titleField")}
                      </label>
                      <Input
                        id="coach-app-title"
                        placeholder={t("form.titlePlaceholder")}
                        required
                        value={form.title}
                        onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                      />
                </div>
                <div className="space-y-2">
                  <label htmlFor="coach-app-fide-id" className="text-sm font-medium">
                    {t("form.fideId")}
                  </label>
                  <Input
                    id="coach-app-fide-id"
                    placeholder={t("form.fideIdPlaceholder")}
                    value={form.fideId}
                    onChange={(event) => setForm((prev) => ({ ...prev, fideId: event.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="coach-app-experience" className="text-sm font-medium">
                    {t("form.experienceYears")}
                  </label>
                  <Input
                    id="coach-app-experience"
                    type="number"
                    min={0}
                    max={80}
                    required
                    value={form.experienceYears}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, experienceYears: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="coach-app-rating" className="text-sm font-medium">
                    {t("form.fideRating")}
                  </label>
                  <Input
                    id="coach-app-rating"
                    type="number"
                    min={0}
                    max={4000}
                    value={form.fideRating}
                    onChange={(event) => setForm((prev) => ({ ...prev, fideRating: event.target.value }))}
                  />
                </div>
              </div>
                </>
              ) : null}

              {currentStep === 1 ? (
                <>
              <div className="space-y-2">
                <label htmlFor="coach-app-phone" className="text-sm font-medium">
                  {t("form.phone")}
                </label>
                <Input
                  id="coach-app-phone"
                  type="tel"
                  required
                  placeholder={t("form.phonePlaceholder")}
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="coach-app-whatsapp" className="text-sm font-medium">
                    {t("form.whatsapp")}
                  </label>
                  <Input
                    id="coach-app-whatsapp"
                    type="tel"
                    placeholder={t("form.phonePlaceholder")}
                    value={form.whatsapp}
                    onChange={(event) => setForm((prev) => ({ ...prev, whatsapp: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="coach-app-whatsapp-link" className="text-sm font-medium">
                    {t("form.whatsappLink")}
                  </label>
                  <Input
                    id="coach-app-whatsapp-link"
                    type="url"
                    placeholder={t("form.whatsappLinkPlaceholder")}
                    value={form.whatsappLink}
                    onChange={(event) => setForm((prev) => ({ ...prev, whatsappLink: event.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="coach-app-telegram" className="text-sm font-medium">
                    {t("form.telegram")}
                  </label>
                  <Input
                    id="coach-app-telegram"
                    placeholder={t("form.telegramPlaceholder")}
                    value={form.telegram}
                    onChange={(event) => setForm((prev) => ({ ...prev, telegram: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="coach-app-telegram-link" className="text-sm font-medium">
                    {t("form.telegramLink")}
                  </label>
                  <Input
                    id="coach-app-telegram-link"
                    type="url"
                    placeholder={t("form.telegramLinkPlaceholder")}
                    value={form.telegramLink}
                    onChange={(event) => setForm((prev) => ({ ...prev, telegramLink: event.target.value }))}
                  />
                </div>
              </div>
                </>
              ) : null}

              {currentStep === 2 ? (
                <>
              <div className="space-y-2">
                <label htmlFor="coach-app-bio" className="text-sm font-medium">
                  {t("form.bio")}
                </label>
                <textarea
                  id="coach-app-bio"
                  rows={4}
                  maxLength={2000}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.bio}
                  onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="coach-app-specialization" className="text-sm font-medium">
                  {t("form.specialization")}
                </label>
                <select
                  id="coach-app-specialization"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.specialization}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      specialization: event.target.value as SpecializationValue,
                    }))
                  }
                >
                  <option value="" disabled>
                    {t("form.specializationPlaceholder")}
                  </option>
                  {SPECIALIZATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(`form.${option.labelKey}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2" ref={languagesMenuRef}>
                <span className="text-sm font-medium">{t("form.languages")}</span>
                <div className="relative">
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={languagesOpen}
                    onClick={() => setLanguagesOpen((prev) => !prev)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className={`truncate text-left ${form.languages.length ? "" : "text-muted-foreground"}`}
                    >
                      {form.languages.length > 0
                        ? form.languages
                            .map((value) => {
                              const option = LANGUAGE_OPTIONS.find((item) => item.value === value);
                              return option ? t(`form.${option.labelKey}`) : value;
                            })
                            .join(", ")
                        : t("form.languagesPlaceholder")}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>

                  {languagesOpen ? (
                    <div
                      role="listbox"
                      className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card p-2 shadow-soft"
                    >
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                        {LANGUAGE_OPTIONS.map((option) => (
                          <label
                            key={option.value}
                            htmlFor={`coach-app-language-${option.value}`}
                            className="flex items-center gap-2 rounded px-1.5 py-1 text-sm transition-colors hover:bg-secondary"
                          >
                            <input
                              id={`coach-app-language-${option.value}`}
                              type="checkbox"
                              className="h-4 w-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              checked={form.languages.includes(option.value)}
                              onChange={() => toggleLanguage(option.value)}
                            />
                            {t(`form.${option.labelKey}`)}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium">{t("form.photo")}</span>
                <div className="flex items-center gap-3">
                  {form.photoDataUrl ? (
                    <img
                      src={form.photoDataUrl}
                      alt=""
                      className="h-10 w-10 rounded-full border border-border object-cover"
                    />
                  ) : null}
                  <label
                    htmlFor="coach-app-photo"
                    className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-secondary"
                  >
                    <Upload className="h-4 w-4" aria-hidden />
                    {photoBusy
                      ? t("form.photoUploading")
                      : form.photoDataUrl
                        ? t("form.photoChange")
                        : t("form.photoUpload")}
                  </label>
                  <input
                    id="coach-app-photo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={handlePhotoChange}
                  />
                  {form.photoDataUrl ? (
                    <button
                      type="button"
                      aria-label={t("form.photoRemove")}
                      className="text-muted-foreground transition hover:text-foreground"
                      onClick={() => setForm((prev) => ({ ...prev, photoDataUrl: "" }))}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">{t("form.photoHint")}</p>
              </div>
                </>
              ) : null}

              {currentStep === 3 ? (
                <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="coach-app-rate" className="text-sm font-medium">
                    {t("form.hourlyRate")}
                  </label>
                  <Input
                    id="coach-app-rate"
                    type="number"
                    min={0}
                    required
                    value={form.hourlyRate}
                    onChange={(event) => setForm((prev) => ({ ...prev, hourlyRate: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="coach-app-currency" className="text-sm font-medium">
                    {t("form.currency")}
                  </label>
                  <select
                    id="coach-app-currency"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.hourlyRateCurrency}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        hourlyRateCurrency: event.target.value as CurrencyValue,
                      }))
                    }
                  >
                    {CURRENCY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
                </>
              ) : null}

              {currentStep === 4 ? (
                <CoachAvailabilityStep
                  value={form.availability}
                  onChange={(availability) => setForm((prev) => ({ ...prev, availability }))}
                />
              ) : null}

              {error ? (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="flex items-center justify-between pt-2">
                {currentStep > 0 ? (
                  <Button type="button" variant="secondary" onClick={handleBack}>
                    {t("form.wizard.back")}
                  </Button>
                ) : (
                  <span />
                )}
                {currentStep < STEPS.length - 1 ? (
                  <Button type="button" onClick={handleNext}>
                    {t("form.wizard.next")}
                  </Button>
                ) : (
                  <Button type="button" onClick={submitApplication} disabled={submitting}>
                    {submitting ? t("form.submitting") : t("form.submit")}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
