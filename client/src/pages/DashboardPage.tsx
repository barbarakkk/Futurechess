import { useNavigate } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Check,
  ChevronRight,
  Crown,
  ExternalLink,
  Flame,
  GraduationCap,
  Globe,
  Link2,
  Swords,
  Trophy,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ResumeGameBanners } from "../components/ResumeGameBanners";
import { api } from "../lib/api";
import { getApiErrorMessage } from "../lib/errors";
import { cn, CURRENCY_SYMBOLS, formatDateTime } from "../lib/utils";
import { useAuthStore } from "../store/authStore";

/** Pulls a game id out of a pasted invite link (any origin/path shape) or accepts a bare id/code. */
function extractGameId(rawInput: string): string | null {
  try {
    const url = new URL(rawInput, window.location.origin);
    const match = url.pathname.match(/\/game\/([^/?#]+)/);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  } catch {
    // Not a parseable URL — fall through to bare id/code handling below.
  }

  if (rawInput && !/[\s/]/.test(rawInput)) {
    return rawInput;
  }

  return null;
}

function bookingStatusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "confirmed") {
    return "default";
  }
  if (status === "declined") {
    return "outline";
  }
  return "secondary";
}

function resultTone(result: string | null): string {
  if (result === "1-0") return "text-emerald-600";
  if (result === "0-1") return "text-red-600";
  return "text-muted-foreground";
}

function isSameLocalDay(isoA: string, isoB: string): boolean {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isSameLocalMonth(isoA: string, isoB: string): boolean {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function formatShortTime(dateIso: string): string {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(
    new Date(dateIso),
  );
}

type RecentGame = {
  id: string;
  status: string;
  result: string | null;
  timeControl: string;
  startedAt: string | null;
  opponentUsername: string | null;
};

type DashboardStats = {
  totalGames: number;
  winRate: number;
  currentStreak: number;
  wins: number;
  draws: number;
  losses: number;
  lossRate: number;
};

const EMPTY_STATS: DashboardStats = {
  totalGames: 0,
  winRate: 0,
  currentStreak: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  lossRate: 0,
};

type CoachBookingSummary = {
  id: string;
  status: string;
  coach: { id: string; name: string; surname: string; photoUrl: string | null };
  slot: { startTime: string; endTime: string };
};

type CoachBooking = {
  id: string;
  status: "pending" | "confirmed" | "declined";
  note: string | null;
  createdAt: string;
  user: { id: string; username: string };
  slot: { startTime: string; endTime: string };
};

type CoachProfile = {
  id: string;
  hourlyRate: number | null;
  hourlyRateCurrency: string | null;
};

// ---- Small presentational pieces shared across the widget grid below ----

function SkeletonBar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-secondary/70", className)} aria-hidden />;
}

function ErrorNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation("dashboard");
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/10">
        <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden />
      </span>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button type="button" size="sm" variant="secondary" className="dashboard-press" onClick={onRetry}>
        {t("retry")}
      </Button>
    </div>
  );
}

function EmptyNotice({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCta,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/70">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-[220px] text-xs text-muted-foreground">{description}</p>
      {ctaLabel ? (
        <Button type="button" size="sm" className="dashboard-press mt-1" onClick={onCta}>
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  percent,
  tone = "text-foreground",
  bar = "bg-primary",
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  percent?: number;
  tone?: string;
  bar?: string;
}) {
  return (
    <div className="min-w-[88px] flex-1 rounded-2xl bg-white/60 px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground whitespace-nowrap">
        {label}
      </p>
      <p className={cn("mt-1 flex items-center gap-1.5 text-2xl font-semibold tabular-nums leading-none", tone)}>
        {value}
        {Icon ? <Icon className="h-4 w-4 text-accent" aria-hidden /> : null}
      </p>
      {percent !== undefined ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/5" aria-hidden>
          <div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function Widget({
  className,
  tint,
  children,
}: {
  className?: string;
  tint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "dashboard-in dashboard-lift relative overflow-hidden rounded-[28px] border border-white/50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.04),0_18px_36px_-20px_rgba(15,70,150,0.32)] backdrop-blur-xl",
        tint ?? "bg-white/70",
        className,
      )}
    >
      {children}
    </div>
  );
}

function formatCountdown(t: ReturnType<typeof useTranslation>["t"], targetIso: string): string {
  const diffMs = new Date(targetIso).getTime() - Date.now();
  if (diffMs <= 0) return t("today.startingNow");

  const totalMinutes = Math.round(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return t("today.inMinutes", { minutes });
  if (minutes === 0) return t("today.inHours", { hours });
  return t("today.inHoursMinutes", { hours, minutes });
}

export function DashboardPage() {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isCoach = user?.role === "coach";

  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [recentError, setRecentError] = useState("");
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [joinLinkInput, setJoinLinkInput] = useState("");
  const [joinError, setJoinError] = useState("");

  // Player-only: sessions this user has booked with a coach.
  const [myBookings, setMyBookings] = useState<CoachBookingSummary[]>([]);
  const [loadingMyBookings, setLoadingMyBookings] = useState(true);
  const [myBookingsError, setMyBookingsError] = useState("");

  // Coach-only: bookings students have made with this coach, plus profile/availability
  // (rate, id, days marked open) needed for the Today/earnings/public-page widgets.
  const [coachBookings, setCoachBookings] = useState<CoachBooking[]>([]);
  const [coachProfile, setCoachProfile] = useState<CoachProfile | null>(null);
  const [availabilityDaysThisMonth, setAvailabilityDaysThisMonth] = useState(0);
  const [loadingCoachExtras, setLoadingCoachExtras] = useState(true);
  const [coachExtrasError, setCoachExtrasError] = useState("");
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respondError, setRespondError] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [bellPosition, setBellPosition] = useState({ top: 0, right: 0 });
  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const notificationsPanelRef = useRef<HTMLDivElement>(null);

  async function loadDashboardData() {
    try {
      setLoadingRecent(true);
      setLoadingStats(true);
      const [recentResponse, statsResponse] = await Promise.all([
        api.get("/games/recent"),
        api.get("/games/stats"),
      ]);
      setRecentGames(recentResponse.data.games ?? []);
      setStats(statsResponse.data.stats ?? EMPTY_STATS);
      setRecentError("");
      setStatsError("");
    } catch (requestError: any) {
      const message = getApiErrorMessage(requestError, t("errors.loadFailed"));
      setRecentError(message);
      setStatsError(message);
    } finally {
      setLoadingRecent(false);
      setLoadingStats(false);
    }
  }

  async function loadMyBookings() {
    try {
      setLoadingMyBookings(true);
      const response = await api.get("/me/coach-bookings");
      setMyBookings(response.data.bookings ?? []);
      setMyBookingsError("");
    } catch (requestError: any) {
      setMyBookingsError(getApiErrorMessage(requestError, t("myBookings.errorLoad")));
    } finally {
      setLoadingMyBookings(false);
    }
  }

  async function loadCoachExtras() {
    try {
      setLoadingCoachExtras(true);
      const [bookingsResponse, availabilityResponse, profileResponse] = await Promise.all([
        api.get("/coach/bookings"),
        api.get("/coach/availability-exceptions"),
        api.get("/coach/me"),
      ]);
      setCoachBookings(bookingsResponse.data.bookings ?? []);
      const now = new Date().toISOString();
      const exceptions: { date: string }[] = availabilityResponse.data.exceptions ?? [];
      setAvailabilityDaysThisMonth(exceptions.filter((e) => isSameLocalMonth(e.date, now)).length);
      setCoachProfile(profileResponse.data.coach ?? null);
      setCoachExtrasError("");
    } catch (requestError: any) {
      setCoachExtrasError(getApiErrorMessage(requestError, t("bookingRequests.error")));
    } finally {
      setLoadingCoachExtras(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function run() {
      await loadDashboardData();
      if (!mounted) return;
      if (isCoach) {
        await loadCoachExtras();
      } else {
        await loadMyBookings();
      }
    }

    run();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCoach]);

  // The panel is portaled to <body> (see render below) so it always paints above the
  // rest of the page regardless of any ancestor's stacking context — the header this
  // button lives in has an entrance animation, and CSS animations leave a lingering
  // non-"none" `transform` on their element even once finished (identity matrix, but
  // still non-"none"), which creates a stacking context that would otherwise trap a
  // plain absolutely-positioned dropdown behind later siblings like the widget grid.
  useLayoutEffect(() => {
    if (!notificationsOpen || !bellButtonRef.current) return;
    const rect = bellButtonRef.current.getBoundingClientRect();
    setBellPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
  }, [notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        bellButtonRef.current &&
        !bellButtonRef.current.contains(target) &&
        notificationsPanelRef.current &&
        !notificationsPanelRef.current.contains(target)
      ) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notificationsOpen]);

  function handleJoinByLink(event: FormEvent) {
    event.preventDefault();
    const trimmed = joinLinkInput.trim();

    if (!trimmed) {
      setJoinError(t("joinGame.emptyError"));
      return;
    }

    const gameId = extractGameId(trimmed);

    if (!gameId) {
      setJoinError(t("joinGame.invalidError"));
      return;
    }

    setJoinError("");
    navigate(`/game/${gameId}`);
  }

  async function handleRespond(bookingId: string, action: "accept" | "decline") {
    setRespondingId(bookingId);
    setRespondError("");
    try {
      const response = await api.post(`/coach/bookings/${bookingId}/respond`, { action });
      const status = response.data.booking.status as CoachBooking["status"];
      setCoachBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status } : b)));
    } catch (requestError: any) {
      setRespondError(getApiErrorMessage(requestError, t("bookingRequests.respondError")));
    } finally {
      setRespondingId(null);
    }
  }

  const now = new Date().toISOString();
  const pendingRequests = coachBookings.filter((b) => b.status === "pending");
  const upcomingSessions = coachBookings.filter((b) => b.status === "confirmed" && new Date(b.slot.endTime) > new Date());
  const completedThisMonth = coachBookings.filter(
    (b) => b.status === "confirmed" && new Date(b.slot.endTime) <= new Date() && isSameLocalMonth(b.slot.endTime, now),
  ).length;
  const todaySession = upcomingSessions.find((s) => isSameLocalDay(s.slot.startTime, now));
  const hourlyRate = coachProfile?.hourlyRate ?? 0;
  const currencySymbol = (coachProfile?.hourlyRateCurrency && CURRENCY_SYMBOLS[coachProfile.hourlyRateCurrency]) || "";
  const earnings = `${currencySymbol}${(completedThisMonth * hourlyRate).toLocaleString()}`;

  return (
    <div className="dashboard-page relative">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-60" aria-hidden>
        <div className="absolute -left-20 top-0 h-[280px] w-[420px] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[240px] w-[360px] rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="space-y-5">
        <header className="dashboard-in flex flex-wrap items-end justify-between gap-2">
          <h1 className="text-[2.1rem] font-semibold leading-[1.05] tracking-[-0.02em]">
            <Trans
              t={t}
              i18nKey="welcomeBack"
              values={{ username: user?.username ?? t("defaultPlayerName") }}
              components={{ 1: <span className="text-primary" /> }}
            />
          </h1>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">{isCoach ? t("subtitleCoach") : t("subtitle")}</p>
            {isCoach ? (
              <div className="relative">
                <button
                  ref={bellButtonRef}
                  type="button"
                  onClick={() => setNotificationsOpen((v) => !v)}
                  aria-label={
                    pendingRequests.length > 0
                      ? t("notifications.ariaLabelUnread", { count: pendingRequests.length })
                      : t("notifications.ariaLabel")
                  }
                  aria-expanded={notificationsOpen}
                  className="dashboard-press relative flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                >
                  <Bell className="h-4 w-4" aria-hidden />
                  {pendingRequests.length > 0 ? (
                    <span className="absolute right-1 top-1 flex h-[7px] w-[7px] rounded-full bg-accent ring-2 ring-card" aria-hidden />
                  ) : null}
                </button>
                {notificationsOpen
                  ? createPortal(
                      <div
                        ref={notificationsPanelRef}
                        style={{ top: bellPosition.top, right: bellPosition.right }}
                        className="dashboard-glass fixed z-30 w-72 overflow-hidden rounded-2xl"
                      >
                        <div className="border-b border-border/40 px-3.5 py-2.5">
                          <p className="text-xs font-semibold uppercase tracking-[0.02em] text-muted-foreground">
                            {t("notifications.title")}
                          </p>
                        </div>
                        {pendingRequests.length === 0 ? (
                          <p className="px-3.5 py-4 text-center text-xs text-muted-foreground">{t("notifications.empty")}</p>
                        ) : (
                          <ul>
                            {pendingRequests.map((r) => (
                              <li key={r.id} className="flex items-start gap-2 border-b border-border/25 px-3.5 py-2.5 last:border-0">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                                <p className="text-xs font-medium leading-snug text-foreground">
                                  {t("notifications.requestMessage", { username: r.user.username })}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>,
                      document.body,
                    )
                  : null}
              </div>
            ) : null}
          </div>
        </header>

        <ResumeGameBanners className="dashboard-in" />

        {isCoach && !loadingCoachExtras && !coachExtrasError && availabilityDaysThisMonth === 0 ? (
          <div className="dashboard-in flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] px-5 py-3.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <p className="text-sm font-medium text-amber-900">{t("availabilityAlert.title")}</p>
            </div>
            <Button
              type="button"
              size="sm"
              className="dashboard-press shrink-0 bg-amber-600 text-white hover:opacity-90"
              onClick={() => navigate("/coach/dashboard")}
            >
              {t("availabilityAlert.cta")}
            </Button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Widget className="col-span-2 md:col-span-4">
            {loadingStats ? (
              <div className="flex items-center gap-4">
                <SkeletonBar className="h-8 w-24" />
                <SkeletonBar className="h-8 w-14" />
                <SkeletonBar className="h-8 w-14" />
                <SkeletonBar className="h-8 w-14" />
                <SkeletonBar className="h-8 w-14" />
              </div>
            ) : statsError ? (
              <ErrorNotice message={statsError} onRetry={loadDashboardData} />
            ) : (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.03em] text-muted-foreground">
                    {t("stats.totalGames.title")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums tracking-[-0.02em]">{stats.totalGames}</p>
                </div>
                <div className="hidden h-9 w-px bg-border/60 sm:block" aria-hidden />
                <div className="flex flex-1 flex-wrap gap-2.5">
                  <StatTile
                    label={t("stats.winRate.title")}
                    value={`${stats.winRate}%`}
                    percent={stats.winRate}
                    tone="text-emerald-600"
                    bar="bg-emerald-500"
                  />
                  <StatTile label={t("stats.currentStreak.title")} value={stats.currentStreak} icon={Flame} />
                  <StatTile label={t("stats.draws.title")} value={stats.draws} />
                  <StatTile
                    label={t("stats.lossRate.title")}
                    value={`${stats.lossRate}%`}
                    percent={stats.lossRate}
                    tone="text-rose-600"
                    bar="bg-rose-500"
                  />
                </div>
              </div>
            )}
          </Widget>

          <Widget tint="bg-gradient-to-br from-[#71808F]/15 to-[#71808F]/5">
            <div className="flex h-full flex-col justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/70 shadow-sm">
                <Globe className="h-[18px] w-[18px] text-[#71808F]" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold tracking-[-0.005em]">{t("playVsFriend.title")}</p>
                <Button
                  type="button"
                  size="sm"
                  className="dashboard-press mt-2 h-7 w-full text-xs"
                  onClick={() => navigate("/new-game")}
                >
                  {t("playVsFriend.cta")}
                </Button>
              </div>
            </div>
          </Widget>

          <Widget tint="bg-gradient-to-br from-[#D4AF37]/15 to-[#D4AF37]/5">
            <div className="flex h-full flex-col justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/70 shadow-sm">
                <Crown className="h-[18px] w-[18px] text-[#D4AF37]" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold tracking-[-0.005em]">{t("playVsAi.title")}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="accent"
                  className="dashboard-press mt-2 h-7 w-full text-xs"
                  onClick={() => navigate("/ai-game/new")}
                >
                  {t("playVsAi.cta")}
                </Button>
              </div>
            </div>
          </Widget>

          {isCoach ? (
            <>
              <Widget>
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.03em] text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden /> {t("today.title")}
                </p>
                {loadingCoachExtras ? (
                  <SkeletonBar className="h-5 w-full" />
                ) : coachExtrasError ? (
                  <p className="text-xs text-muted-foreground">—</p>
                ) : todaySession ? (
                  <>
                    <p className="text-sm font-medium">{todaySession.user.username}</p>
                    <p className="text-xs text-muted-foreground">{formatCountdown(t, todaySession.slot.startTime)}</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("today.empty")}</p>
                )}
              </Widget>

              <Widget>
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.03em] text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" aria-hidden /> {t("earnings.title")}
                </p>
                {loadingCoachExtras ? (
                  <SkeletonBar className="h-5 w-full" />
                ) : coachExtrasError ? (
                  <p className="text-xs text-muted-foreground">—</p>
                ) : (
                  <>
                    <p className="text-sm font-semibold tabular-nums">{earnings}</p>
                    <p className="text-xs text-muted-foreground">{t("earnings.sessionsCompleted", { count: completedThisMonth })}</p>
                  </>
                )}
              </Widget>

              <Widget className="col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.03em] text-muted-foreground">
                    <GraduationCap className="h-3.5 w-3.5" aria-hidden /> {t("publicPage.title")}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="dashboard-press h-7 gap-1 px-0 text-xs text-primary"
                    disabled={!coachProfile}
                    onClick={() => coachProfile && navigate(`/coaches/${coachProfile.id}`)}
                  >
                    {t("publicPage.cta")}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
              </Widget>
            </>
          ) : null}

          <Widget className="col-span-2 md:col-span-2 md:row-span-2">
            <div className="flex h-full flex-col">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.03em] text-muted-foreground">
                  {t("recentGames.title")}
                </p>
                <Trophy className="h-3.5 w-3.5 text-primary/70" aria-hidden />
              </div>
              {loadingRecent ? (
                <div className="flex-1 space-y-2">
                  {[0, 1, 2].map((i) => (
                    <SkeletonBar key={i} className="h-5 w-full" />
                  ))}
                </div>
              ) : recentError ? (
                <ErrorNotice message={t("recentGames.errorLoad")} onRetry={loadDashboardData} />
              ) : recentGames.length === 0 ? (
                <EmptyNotice
                  icon={Swords}
                  title={t("recentGames.empty")}
                  description={t("recentGames.emptyDescription")}
                  ctaLabel={t("playVsFriend.cta")}
                  onCta={() => navigate("/new-game")}
                />
              ) : (
                <ul className="-mx-1 flex-1 space-y-0.5">
                  {recentGames.map((game) => (
                    <li key={game.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/game/${game.id}`)}
                        className="dashboard-press flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-left text-sm transition-colors hover:bg-white/60"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="font-medium">{game.timeControl}</span>
                          {game.opponentUsername ? (
                            <span className="truncate text-xs text-muted-foreground">
                              {t("recentGames.opponent", { username: game.opponentUsername })}
                            </span>
                          ) : null}
                        </span>
                        <span className={cn("shrink-0 text-xs font-medium tabular-nums", resultTone(game.result))}>
                          {game.status === "active"
                            ? t("recentGames.inProgress")
                            : game.status === "waiting"
                              ? t("recentGames.waiting")
                              : game.result}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Widget>

          {isCoach ? (
            <Widget className="col-span-2 md:col-span-2 md:row-span-2" tint="bg-accent/10">
              <div className="flex h-full flex-col">
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.03em] text-muted-foreground">
                    <Bell className="h-3.5 w-3.5 text-accent" aria-hidden /> {t("bookingRequests.title")}
                  </p>
                  <span className="flex items-center gap-2">
                    {pendingRequests.length > 0 ? <Badge variant="secondary">{pendingRequests.length}</Badge> : null}
                    {!loadingCoachExtras && !coachExtrasError ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                        {t("bookingRequests.daysOpen", { count: availabilityDaysThisMonth })}
                      </span>
                    ) : null}
                  </span>
                </div>

                {respondError ? (
                  <p className="mb-2 text-xs text-red-600" role="alert">
                    {respondError}
                  </p>
                ) : null}

                {loadingCoachExtras ? (
                  <div className="flex-1 space-y-2">
                    {[0, 1].map((i) => (
                      <SkeletonBar key={i} className="h-5 w-full" />
                    ))}
                  </div>
                ) : coachExtrasError ? (
                  <ErrorNotice message={coachExtrasError} onRetry={loadCoachExtras} />
                ) : pendingRequests.length === 0 ? (
                  <EmptyNotice icon={Bell} title={t("bookingRequests.emptyTitle")} description={t("bookingRequests.emptyDescription")} />
                ) : (
                  <div className="flex-1 rounded-2xl bg-white/60 p-3">
                    <p className="text-sm font-medium">{pendingRequests[0].user.username}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatShortTime(pendingRequests[0].slot.startTime)}</p>
                    {pendingRequests[0].note ? (
                      <p className="mt-1.5 line-clamp-2 text-xs italic text-muted-foreground">"{pendingRequests[0].note}"</p>
                    ) : null}
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={respondingId === pendingRequests[0].id}
                        className="dashboard-press h-7 flex-1 gap-1 text-xs"
                        onClick={() => handleRespond(pendingRequests[0].id, "accept")}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden />
                        {t("bookingRequests.accept")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={respondingId === pendingRequests[0].id}
                        className="dashboard-press h-7 flex-1 gap-1 text-xs"
                        onClick={() => handleRespond(pendingRequests[0].id, "decline")}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                        {t("bookingRequests.decline")}
                      </Button>
                    </div>
                    {pendingRequests.length > 1 ? (
                      <p className="mt-2 text-center text-xs text-muted-foreground">
                        +{pendingRequests.length - 1} more
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </Widget>
          ) : (
            <Widget className="col-span-2 md:col-span-2 md:row-span-2">
              <div className="flex h-full flex-col">
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.03em] text-muted-foreground">
                    <GraduationCap className="h-3.5 w-3.5" aria-hidden /> {t("myBookings.title")}
                  </p>
                </div>
                {loadingMyBookings ? (
                  <div className="flex-1 space-y-2">
                    {[0, 1].map((i) => (
                      <SkeletonBar key={i} className="h-5 w-full" />
                    ))}
                  </div>
                ) : myBookingsError ? (
                  <ErrorNotice message={myBookingsError} onRetry={loadMyBookings} />
                ) : myBookings.length === 0 ? (
                  <EmptyNotice
                    icon={GraduationCap}
                    title={t("myBookings.empty")}
                    description={t("myBookings.emptyDescription")}
                    ctaLabel={t("myBookings.browseCoaches")}
                    onCta={() => navigate("/coaches")}
                  />
                ) : (
                  <>
                    <ul className="flex-1 space-y-1.5">
                      {myBookings.map((booking) => (
                        <li key={booking.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/60 px-2.5 py-2 text-sm">
                          <span className="truncate font-medium">
                            {booking.coach.name} {booking.coach.surname}
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                            {formatDateTime(booking.slot.startTime)}
                            <Badge variant={bookingStatusVariant(booking.status)}>
                              {t(`myBookings.status.${booking.status}`, booking.status)}
                            </Badge>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="dashboard-press mt-1 h-7 gap-1 self-start px-0 text-xs text-primary"
                      onClick={() => navigate("/coaches")}
                    >
                      {t("myBookings.browseCoaches")}
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </>
                )}
              </div>
            </Widget>
          )}

          <Widget className="col-span-2 md:col-span-4">
            <form className="flex items-center gap-3" onSubmit={handleJoinByLink}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <Link2 className="h-4 w-4 text-primary" aria-hidden />
              </span>
              <p className="shrink-0 text-sm font-semibold tracking-[-0.005em]">{t("joinGame.title")}</p>
              <Input
                type="text"
                value={joinLinkInput}
                onChange={(event) => {
                  setJoinLinkInput(event.target.value);
                  if (joinError) setJoinError("");
                }}
                placeholder={t("joinGame.placeholder")}
                aria-label={t("joinGame.title")}
                className="h-9 flex-1 border-white/60 bg-white/60 text-sm"
              />
              <Button type="submit" size="sm" className="dashboard-press shrink-0">
                {t("joinGame.button")}
              </Button>
            </form>
            {joinError ? (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {joinError}
              </p>
            ) : null}
          </Widget>
        </div>
      </div>
    </div>
  );
}
