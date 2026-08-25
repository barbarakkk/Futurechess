import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  UserRound,
  Upload,
  X,
} from "lucide-react";
import { TelegramIcon, WhatsAppIcon } from "../components/BrandIcons";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { api } from "../lib/api";
import { resizeImageToDataUrl } from "../lib/coachPhoto";
import {
  CURRENCY_OPTIONS,
  LANGUAGE_OPTIONS,
  SPECIALIZATION_OPTIONS,
  type CurrencyValue,
  type SpecializationValue,
} from "../lib/coachProfileOptions";
import { getApiErrorMessage } from "../lib/errors";
import { cn, formatSlotRange } from "../lib/utils";
import { useAuthStore } from "../store/authStore";

type Booking = {
  id: string;
  status: "pending" | "confirmed" | "declined";
  note: string | null;
  createdAt: string;
  user: { id: string; username: string };
  slot: { startTime: string; endTime: string };
};

type Coach = {
  id: string;
  name: string;
  surname: string;
  title: string;
  fideId: string | null;
  experienceYears: number;
  bio: string | null;
  photoUrl: string | null;
  fideRating: number | null;
  specialties: string[];
  languages: string[];
  hourlyRate: number | null;
  hourlyRateCurrency: string | null;
  phone: string | null;
  whatsapp: string | null;
  whatsappLink: string | null;
  telegram: string | null;
  telegramLink: string | null;
};

type ProfileForm = {
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
};

function coachToProfileForm(coach: Coach): ProfileForm {
  return {
    name: coach.name,
    surname: coach.surname,
    title: coach.title,
    fideId: coach.fideId ?? "",
    experienceYears: String(coach.experienceYears),
    bio: coach.bio ?? "",
    photoDataUrl: coach.photoUrl ?? "",
    fideRating: coach.fideRating != null ? String(coach.fideRating) : "",
    specialization: (coach.specialties[0] as SpecializationValue) ?? "",
    languages: coach.languages,
    hourlyRate: coach.hourlyRate != null ? String(coach.hourlyRate) : "",
    hourlyRateCurrency: (coach.hourlyRateCurrency as CurrencyValue) ?? "GEL",
    phone: coach.phone ?? "",
    whatsapp: coach.whatsapp ?? "",
    whatsappLink: coach.whatsappLink ?? "",
    telegram: coach.telegram ?? "",
    telegramLink: coach.telegramLink ?? "",
  };
}

function toOptionalInt(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : undefined;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DD" — matches the date-only format the server's availability-exceptions API expects. */
function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function getMonthCells(year: number, month: number): (number | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  return cells;
}

export function CoachDashboardPage() {
  const { t, i18n } = useTranslation("coachDashboard");
  const user = useAuthStore((state) => state.user);

  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [saved, setSaved] = useState(false);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingsError, setBookingsError] = useState("");
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const [profileForm, setProfileForm] = useState<ProfileForm | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [languagesOpen, setLanguagesOpen] = useState(false);
  const languagesMenuRef = useRef<HTMLDivElement>(null);

  const loadProfile = useCallback(async () => {
    try {
      const response = await api.get("/coach/me");
      setProfileForm(coachToProfileForm(response.data.coach));
      setProfileError("");
    } catch (requestError: any) {
      setProfileError(getApiErrorMessage(requestError, t("errors.loadProfile")));
    } finally {
      setLoadingProfile(false);
    }
  }, [t]);

  const loadAvailability = useCallback(async () => {
    try {
      const response = await api.get("/coach/availability-exceptions");
      const exceptions: { date: string }[] = response.data.exceptions ?? [];
      setSelectedDates(new Set(exceptions.map((exception) => exception.date)));
      setAvailabilityError("");
    } catch (requestError: any) {
      setAvailabilityError(getApiErrorMessage(requestError, t("errors.loadRules")));
    } finally {
      setLoadingAvailability(false);
    }
  }, [t]);

  const loadBookings = useCallback(async () => {
    try {
      const response = await api.get("/coach/bookings");
      setBookings(response.data.bookings ?? []);
      setBookingsError("");
    } catch (requestError: any) {
      setBookingsError(getApiErrorMessage(requestError, t("errors.loadBookings")));
    } finally {
      setLoadingBookings(false);
    }
  }, [t]);

  useEffect(() => {
    if (user?.role !== "coach") {
      return;
    }
    loadProfile();
    loadAvailability();
    loadBookings();
  }, [user?.role, loadProfile, loadAvailability, loadBookings]);

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

  if (user?.role !== "coach") {
    return <Navigate to="/dashboard" replace />;
  }

  function updateProfileField<K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) {
    setProfileForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    setProfileSaved(false);
  }

  function toggleProfileLanguage(language: string) {
    setProfileForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        languages: prev.languages.includes(language)
          ? prev.languages.filter((item) => item !== language)
          : [...prev.languages, language],
      };
    });
    setProfileSaved(false);
  }

  async function handleProfilePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !profileForm) return;

    if (!file.type.startsWith("image/")) {
      setProfileError(t("profile.photoInvalidType"));
      return;
    }

    setPhotoBusy(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      updateProfileField("photoDataUrl", dataUrl);
      setProfileError("");
    } catch {
      setProfileError(t("profile.photoResizeError"));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleSaveProfile() {
    if (!profileForm) return;

    if (
      !profileForm.name.trim() ||
      !profileForm.surname.trim() ||
      !profileForm.title.trim() ||
      profileForm.experienceYears.trim() === "" ||
      !profileForm.phone.trim() ||
      !profileForm.specialization ||
      profileForm.languages.length === 0 ||
      profileForm.hourlyRate.trim() === ""
    ) {
      setProfileError(t("profile.incompleteError"));
      return;
    }

    setSavingProfile(true);
    setProfileError("");
    try {
      const response = await api.put("/coach/profile", {
        name: profileForm.name.trim(),
        surname: profileForm.surname.trim(),
        title: profileForm.title.trim(),
        fideId: profileForm.fideId.trim() || undefined,
        experienceYears: Number(profileForm.experienceYears),
        bio: profileForm.bio.trim() || undefined,
        photoUrl: profileForm.photoDataUrl || undefined,
        fideRating: toOptionalInt(profileForm.fideRating),
        specialties: [profileForm.specialization],
        languages: profileForm.languages,
        hourlyRate: Number(profileForm.hourlyRate),
        hourlyRateCurrency: profileForm.hourlyRateCurrency,
        phone: profileForm.phone.trim(),
        whatsapp: profileForm.whatsapp.trim() || undefined,
        whatsappLink: profileForm.whatsappLink.trim() || undefined,
        telegram: profileForm.telegram.trim() || undefined,
        telegramLink: profileForm.telegramLink.trim() || undefined,
      });
      setProfileForm(coachToProfileForm(response.data.coach));
      setProfileSaved(true);
    } catch (requestError: any) {
      setProfileError(getApiErrorMessage(requestError, t("errors.saveProfile")));
    } finally {
      setSavingProfile(false);
    }
  }

  function isPast(day: number): boolean {
    const cellDate = new Date(viewYear, viewMonth, day);
    cellDate.setHours(0, 0, 0, 0);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return cellDate < startOfToday;
  }

  function toggleDay(day: number | null) {
    if (!day || isPast(day)) {
      return;
    }
    const key = dateKey(viewYear, viewMonth, day);
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    setSaved(false);
  }

  function goToPreviousMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  async function handleSaveAvailability() {
    setSavingAvailability(true);
    setAvailabilityError("");
    try {
      const response = await api.put("/coach/availability-exceptions", { dates: [...selectedDates] });
      const dates: string[] = response.data.dates ?? [];
      setSelectedDates(new Set(dates));
      setSaved(true);
    } catch (requestError: any) {
      setAvailabilityError(getApiErrorMessage(requestError, t("errors.saveRules")));
    } finally {
      setSavingAvailability(false);
    }
  }

  async function handleRespond(bookingId: string, action: "accept" | "decline") {
    setRespondingId(bookingId);
    try {
      const response = await api.post(`/coach/bookings/${bookingId}/respond`, { action });
      const status = response.data.booking.status as Booking["status"];
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status } : b)));
    } catch (requestError: any) {
      setBookingsError(getApiErrorMessage(requestError, t("errors.respond")));
    } finally {
      setRespondingId(null);
    }
  }

  const pendingBookings = bookings.filter((b) => b.status === "pending");
  const otherBookings = bookings.filter((b) => b.status !== "pending");

  const cells = getMonthCells(viewYear, viewMonth);
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const monthPrefix = `${viewYear}-${pad2(viewMonth + 1)}-`;
  const selectedThisMonth = [...selectedDates].filter((key) => key.startsWith(monthPrefix));
  const totalSelected = selectedDates.size;

  const monthLabel = new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }).format(
    new Date(viewYear, viewMonth, 1),
  );
  const monthOnlyLabel = new Intl.DateTimeFormat(i18n.language, { month: "long" }).format(
    new Date(viewYear, viewMonth, 1),
  );
  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(i18n.language, { weekday: "short" });
    // 2024-01-07 is a Sunday — used purely as a stable reference to enumerate weekday names.
    return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(2024, 0, 7 + i)));
  }, [i18n.language]);

  function clearThisMonth() {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      selectedThisMonth.forEach((key) => next.delete(key));
      return next;
    });
    setSaved(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <GraduationCap className="h-3.5 w-3.5 text-primary" aria-hidden />
          {t("badge")}
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
      </div>

      <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserRound className="h-5 w-5 text-primary" aria-hidden />
            {t("profile.title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("profile.subtitle")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingProfile ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}

          {!loadingProfile && profileForm ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="coach-profile-name" className="text-sm font-medium">
                    {t("profile.name")}
                  </label>
                  <Input
                    id="coach-profile-name"
                    required
                    value={profileForm.name}
                    onChange={(event) => updateProfileField("name", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="coach-profile-surname" className="text-sm font-medium">
                    {t("profile.surname")}
                  </label>
                  <Input
                    id="coach-profile-surname"
                    required
                    value={profileForm.surname}
                    onChange={(event) => updateProfileField("surname", event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="coach-profile-title" className="text-sm font-medium">
                    {t("profile.titleField")}
                  </label>
                  <Input
                    id="coach-profile-title"
                    required
                    value={profileForm.title}
                    onChange={(event) => updateProfileField("title", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="coach-profile-fide-id" className="text-sm font-medium">
                    {t("profile.fideId")}
                  </label>
                  <Input
                    id="coach-profile-fide-id"
                    value={profileForm.fideId}
                    onChange={(event) => updateProfileField("fideId", event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="coach-profile-experience" className="text-sm font-medium">
                    {t("profile.experienceYears")}
                  </label>
                  <Input
                    id="coach-profile-experience"
                    type="number"
                    min={0}
                    max={80}
                    required
                    value={profileForm.experienceYears}
                    onChange={(event) => updateProfileField("experienceYears", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="coach-profile-rating" className="text-sm font-medium">
                    {t("profile.fideRating")}
                  </label>
                  <Input
                    id="coach-profile-rating"
                    type="number"
                    min={0}
                    max={4000}
                    value={profileForm.fideRating}
                    onChange={(event) => updateProfileField("fideRating", event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="coach-profile-bio" className="text-sm font-medium">
                  {t("profile.bio")}
                </label>
                <textarea
                  id="coach-profile-bio"
                  rows={4}
                  maxLength={2000}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={profileForm.bio}
                  onChange={(event) => updateProfileField("bio", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="coach-profile-specialization" className="text-sm font-medium">
                  {t("profile.specialization")}
                </label>
                <select
                  id="coach-profile-specialization"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={profileForm.specialization}
                  onChange={(event) =>
                    updateProfileField("specialization", event.target.value as SpecializationValue)
                  }
                >
                  <option value="" disabled>
                    {t("profile.specializationPlaceholder")}
                  </option>
                  {SPECIALIZATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(`profile.${option.labelKey}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2" ref={languagesMenuRef}>
                <span className="text-sm font-medium">{t("profile.languages")}</span>
                <div className="relative">
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={languagesOpen}
                    onClick={() => setLanguagesOpen((prev) => !prev)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className={`truncate text-left ${profileForm.languages.length ? "" : "text-muted-foreground"}`}
                    >
                      {profileForm.languages.length > 0
                        ? profileForm.languages
                            .map((value) => {
                              const option = LANGUAGE_OPTIONS.find((item) => item.value === value);
                              return option ? t(`profile.${option.labelKey}`) : value;
                            })
                            .join(", ")
                        : t("profile.languagesPlaceholder")}
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
                            htmlFor={`coach-profile-language-${option.value}`}
                            className="flex items-center gap-2 rounded px-1.5 py-1 text-sm transition-colors hover:bg-secondary"
                          >
                            <input
                              id={`coach-profile-language-${option.value}`}
                              type="checkbox"
                              className="h-4 w-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              checked={profileForm.languages.includes(option.value)}
                              onChange={() => toggleProfileLanguage(option.value)}
                            />
                            {t(`profile.${option.labelKey}`)}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium">{t("profile.photo")}</span>
                <div className="flex items-center gap-3">
                  {profileForm.photoDataUrl ? (
                    <img
                      src={profileForm.photoDataUrl}
                      alt=""
                      className="h-10 w-10 rounded-full border border-border object-cover"
                    />
                  ) : null}
                  <label
                    htmlFor="coach-profile-photo"
                    className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-secondary"
                  >
                    <Upload className="h-4 w-4" aria-hidden />
                    {photoBusy
                      ? t("profile.photoUploading")
                      : profileForm.photoDataUrl
                        ? t("profile.photoChange")
                        : t("profile.photoUpload")}
                  </label>
                  <input
                    id="coach-profile-photo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={handleProfilePhotoChange}
                  />
                  {profileForm.photoDataUrl ? (
                    <button
                      type="button"
                      aria-label={t("profile.photoRemove")}
                      className="text-muted-foreground transition hover:text-foreground"
                      onClick={() => updateProfileField("photoDataUrl", "")}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="coach-profile-rate" className="text-sm font-medium">
                    {t("profile.hourlyRate")}
                  </label>
                  <Input
                    id="coach-profile-rate"
                    type="number"
                    min={0}
                    required
                    value={profileForm.hourlyRate}
                    onChange={(event) => updateProfileField("hourlyRate", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="coach-profile-currency" className="text-sm font-medium">
                    {t("profile.currency")}
                  </label>
                  <select
                    id="coach-profile-currency"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={profileForm.hourlyRateCurrency}
                    onChange={(event) =>
                      updateProfileField("hourlyRateCurrency", event.target.value as CurrencyValue)
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

              <div className="space-y-2">
                <label htmlFor="coach-profile-phone" className="text-sm font-medium">
                  {t("profile.phone")}
                </label>
                <Input
                  id="coach-profile-phone"
                  type="tel"
                  required
                  value={profileForm.phone}
                  onChange={(event) => updateProfileField("phone", event.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="coach-profile-whatsapp" className="text-sm font-medium">
                    {t("profile.whatsapp")}
                  </label>
                  <Input
                    id="coach-profile-whatsapp"
                    type="tel"
                    value={profileForm.whatsapp}
                    onChange={(event) => updateProfileField("whatsapp", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="coach-profile-whatsapp-link" className="text-sm font-medium">
                    {t("profile.whatsappLink")}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="coach-profile-whatsapp-link"
                      type="url"
                      value={profileForm.whatsappLink}
                      onChange={(event) => updateProfileField("whatsappLink", event.target.value)}
                    />
                    <a
                      href={profileForm.whatsappLink.trim() || undefined}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={t("profile.openWhatsappAria")}
                      aria-disabled={!profileForm.whatsappLink.trim()}
                      onClick={(event) => {
                        if (!profileForm.whatsappLink.trim()) event.preventDefault();
                      }}
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-input bg-background text-[#25D366] transition-colors hover:bg-accent",
                        !profileForm.whatsappLink.trim() && "pointer-events-none opacity-40"
                      )}
                    >
                      <WhatsAppIcon className="h-5 w-5" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="coach-profile-telegram" className="text-sm font-medium">
                    {t("profile.telegram")}
                  </label>
                  <Input
                    id="coach-profile-telegram"
                    value={profileForm.telegram}
                    onChange={(event) => updateProfileField("telegram", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="coach-profile-telegram-link" className="text-sm font-medium">
                    {t("profile.telegramLink")}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="coach-profile-telegram-link"
                      type="url"
                      value={profileForm.telegramLink}
                      onChange={(event) => updateProfileField("telegramLink", event.target.value)}
                    />
                    <a
                      href={profileForm.telegramLink.trim() || undefined}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={t("profile.openTelegramAria")}
                      aria-disabled={!profileForm.telegramLink.trim()}
                      onClick={(event) => {
                        if (!profileForm.telegramLink.trim()) event.preventDefault();
                      }}
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-input bg-background text-[#229ED9] transition-colors hover:bg-accent",
                        !profileForm.telegramLink.trim() && "pointer-events-none opacity-40"
                      )}
                    >
                      <TelegramIcon className="h-5 w-5" />
                    </a>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {profileError ? (
            <p className="text-sm text-red-600" role="alert">
              {profileError}
            </p>
          ) : null}

          <Button
            type="button"
            onClick={handleSaveProfile}
            disabled={savingProfile || loadingProfile || !profileForm}
            className={cn(profileSaved && "bg-emerald-600 hover:opacity-90")}
          >
            {savingProfile ? (
              t("profile.saving")
            ) : profileSaved ? (
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4" aria-hidden />
                {t("profile.saved")}
              </span>
            ) : (
              t("profile.save")
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5 text-primary" aria-hidden />
            {t("availability.title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("availability.subtitle")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingAvailability ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}

          {!loadingAvailability ? (
            <>
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={goToPreviousMonth}
                  aria-label={t("availability.prevMonth")}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </Button>
                <p className="text-sm font-semibold capitalize">{monthLabel}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={goToNextMonth}
                  aria-label={t("availability.nextMonth")}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {weekdayLabels.map((label, i) => (
                  <div key={`${label}-${i}`} className="text-xs font-medium uppercase text-muted-foreground">
                    {label}
                  </div>
                ))}

                {cells.map((day, i) => {
                  const key = day ? dateKey(viewYear, viewMonth, day) : null;
                  const isSelected = Boolean(key && selectedDates.has(key));
                  const past = day ? isPast(day) : false;
                  const isToday = key === todayKey;

                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!day || past}
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-md border border-transparent text-sm transition-colors",
                        !day && "cursor-default",
                        day && past && "cursor-default text-muted-foreground/40",
                        day && !past && !isSelected && "text-foreground hover:bg-[#eff6ff]",
                        day && !past && isSelected && "border-primary bg-primary font-semibold text-primary-foreground",
                        day && !past && !isSelected && isToday && "border-primary font-semibold text-primary",
                      )}
                    >
                      {day ?? ""}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-primary" aria-hidden />
                  {t("availability.legendAvailable")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px] border border-primary" aria-hidden />
                  {t("availability.legendToday")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-secondary" aria-hidden />
                  {t("availability.legendUnavailable")}
                </span>
              </div>

              {totalSelected > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#eff6ff] px-3.5 py-2.5">
                  <span className="text-sm font-medium text-primary">
                    {t("availability.daysSelected", { count: totalSelected })}
                    {selectedThisMonth.length > 0
                      ? t("availability.thisMonthSuffix", { count: selectedThisMonth.length })
                      : null}
                  </span>
                  {selectedThisMonth.length > 0 ? (
                    <button
                      type="button"
                      onClick={clearThisMonth}
                      className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
                    >
                      {t("availability.clearMonth", { month: monthOnlyLabel })}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}

          <p className="text-xs text-muted-foreground">{t("availability.utcNote")}</p>

          {availabilityError ? (
            <p className="text-sm text-red-600" role="alert">
              {availabilityError}
            </p>
          ) : null}

          <Button
            type="button"
            onClick={handleSaveAvailability}
            disabled={savingAvailability || loadingAvailability}
            className={cn(saved && "bg-emerald-600 hover:opacity-90")}
          >
            {savingAvailability ? (
              t("availability.saving")
            ) : saved ? (
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4" aria-hidden />
                {t("availability.saved")}
              </span>
            ) : totalSelected === 0 ? (
              t("availability.save")
            ) : (
              t("availability.saveCount", { count: totalSelected })
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t("bookings.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingBookings ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}
          {bookingsError ? (
            <p className="text-sm text-red-600" role="alert">
              {bookingsError}
            </p>
          ) : null}
          {!loadingBookings && bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("bookings.empty")}</p>
          ) : null}

          {pendingBookings.map((booking) => (
            <div key={booking.id} className="space-y-2 rounded-lg border border-border/80 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{booking.user.username}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatSlotRange(booking.slot.startTime, booking.slot.endTime)}
                  </p>
                </div>
                <Badge variant="outline">{t("bookings.statusLabel.pending")}</Badge>
              </div>
              {booking.note ? <p className="text-sm text-muted-foreground">"{booking.note}"</p> : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={respondingId === booking.id}
                  onClick={() => handleRespond(booking.id, "accept")}
                  className="gap-1.5"
                >
                  <Check className="h-4 w-4" aria-hidden />
                  {t("bookings.accept")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={respondingId === booking.id}
                  onClick={() => handleRespond(booking.id, "decline")}
                  className="gap-1.5"
                >
                  <X className="h-4 w-4" aria-hidden />
                  {t("bookings.decline")}
                </Button>
              </div>
            </div>
          ))}

          {otherBookings.map((booking) => (
            <div
              key={booking.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-3 opacity-80"
            >
              <div>
                <p className="font-medium">{booking.user.username}</p>
                <p className="text-sm text-muted-foreground">
                  {formatSlotRange(booking.slot.startTime, booking.slot.endTime)}
                </p>
              </div>
              <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
                {t(`bookings.statusLabel.${booking.status}` as const)}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
