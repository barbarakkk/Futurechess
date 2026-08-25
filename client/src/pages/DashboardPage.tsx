import { useNavigate } from "react-router-dom";
import { useEffect, useState, type FormEvent } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  ChevronRight,
  Crown,
  Flame,
  GraduationCap,
  LayoutGrid,
  Link2,
  Sparkles,
  Swords,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { api } from "../lib/api";
import { getApiErrorMessage } from "../lib/errors";
import { formatDateTime } from "../lib/utils";
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

type RecentGame = {
  id: string;
  status: string;
  result: string | null;
  timeControl: string;
  startedAt: string | null;
};

type DashboardStats = {
  totalGames: number;
  winRate: number;
  currentStreak: number;
};

type CoachBookingSummary = {
  id: string;
  status: string;
  coach: { id: string; name: string; surname: string; photoUrl: string | null };
  slot: { startTime: string; endTime: string };
};

export function DashboardPage() {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [recentError, setRecentError] = useState("");
  const [stats, setStats] = useState<DashboardStats>({
    totalGames: 0,
    winRate: 0,
    currentStreak: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [joinLinkInput, setJoinLinkInput] = useState("");
  const [joinError, setJoinError] = useState("");
  const [coachBookings, setCoachBookings] = useState<CoachBookingSummary[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingsError, setBookingsError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDashboardData() {
      try {
        setLoadingRecent(true);
        setLoadingStats(true);
        const [recentResponse, statsResponse] = await Promise.all([
          api.get("/games/recent"),
          api.get("/games/stats"),
        ]);

        if (mounted) {
          setRecentGames(recentResponse.data.games ?? []);
          setStats(statsResponse.data.stats ?? { totalGames: 0, winRate: 0, currentStreak: 0 });
          setRecentError("");
          setStatsError("");
        }
      } catch (requestError: any) {
        if (mounted) {
          const message = getApiErrorMessage(
            requestError,
            t("errors.loadFailed"),
          );
          setRecentError(message);
          setStatsError(message);
        }
      } finally {
        if (mounted) {
          setLoadingRecent(false);
          setLoadingStats(false);
        }
      }
    }

    async function loadCoachBookings() {
      try {
        setLoadingBookings(true);
        const response = await api.get("/me/coach-bookings");
        if (mounted) {
          setCoachBookings(response.data.bookings ?? []);
          setBookingsError("");
        }
      } catch (requestError: any) {
        if (mounted) {
          setBookingsError(getApiErrorMessage(requestError, t("errors.loadFailed")));
        }
      } finally {
        if (mounted) {
          setLoadingBookings(false);
        }
      }
    }

    loadCoachBookings();

    loadDashboardData();

    return () => {
      mounted = false;
    };
  }, []);

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

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-60" aria-hidden>
        <div className="absolute -left-20 top-0 h-[280px] w-[420px] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[240px] w-[360px] rounded-full bg-accent/10 blur-3xl" />
      </div>

      <section className="space-y-10">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            {t("badge")}
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              <Trans
                t={t}
                i18nKey="welcomeBack"
                values={{ username: user?.username ?? t("defaultPlayerName") }}
                components={{
                  1: (
                    <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent" />
                  ),
                }}
              />
            </h1>
            <p className="max-w-xl text-base text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>
        </header>

        {statsError ? (
          <p className="text-sm text-red-600" role="alert">
            {statsError}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("stats.totalGames.title")}
              </CardTitle>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <LayoutGrid className="h-4 w-4 text-primary" aria-hidden />
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingStats ? (
                <div className="h-9 w-16 animate-pulse rounded-md bg-secondary" aria-hidden />
              ) : (
                <p className="text-3xl font-semibold tracking-tight">{stats.totalGames}</p>
              )}
              <Badge variant="secondary">{t("stats.totalGames.badge")}</Badge>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("stats.winRate.title")}
              </CardTitle>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingStats ? (
                <div className="h-9 w-16 animate-pulse rounded-md bg-secondary" aria-hidden />
              ) : (
                <p className="text-3xl font-semibold tracking-tight">{stats.winRate}%</p>
              )}
              <Badge variant="outline">{t("stats.winRate.badge")}</Badge>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("stats.currentStreak.title")}
              </CardTitle>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <Flame className="h-4 w-4 text-accent" aria-hidden />
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingStats ? (
                <div className="h-9 w-16 animate-pulse rounded-md bg-secondary" aria-hidden />
              ) : (
                <p className="text-3xl font-semibold tracking-tight">{stats.currentStreak}W</p>
              )}
              <Badge variant="secondary">{t("stats.currentStreak.badge")}</Badge>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="overflow-hidden border-border/80 bg-gradient-to-br from-card/90 via-card/70 to-secondary/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                  <Swords className="h-5 w-5 text-[#71808F]" aria-hidden />
                </span>
                {t("playVsFriend.title")}
              </CardTitle>
              <CardDescription>
                {t("playVsFriend.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{t("playVsFriend.timeControls.bullet")}</Badge>
                <Badge variant="outline">{t("playVsFriend.timeControls.blitz")}</Badge>
                <Badge variant="outline">{t("playVsFriend.timeControls.rapid")}</Badge>
                <Badge variant="outline">{t("playVsFriend.timeControls.classical")}</Badge>
              </div>
              <Button type="button" className="w-full" onClick={() => navigate("/new-game")}>
                {t("playVsFriend.cta")}
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/80 bg-gradient-to-br from-card/90 via-card/70 to-accent/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                  <Crown className="h-5 w-5 text-[#D4AF37]" aria-hidden />
                </span>
                {t("playVsAi.title")}
              </CardTitle>
              <CardDescription>
                {t("playVsAi.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{t("playVsAi.difficulties.easy")}</Badge>
                <Badge variant="outline">{t("playVsAi.difficulties.medium")}</Badge>
                <Badge variant="outline">{t("playVsAi.difficulties.hard")}</Badge>
              </div>
              <Button
                type="button"
                variant="accent"
                className="w-full"
                onClick={() => navigate("/ai-game/new")}
              >
                {t("playVsAi.cta")}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                <Link2 className="h-5 w-5 text-primary" aria-hidden />
              </span>
              {t("joinGame.title")}
            </CardTitle>
            <CardDescription>{t("joinGame.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleJoinByLink}>
              <Input
                type="text"
                value={joinLinkInput}
                onChange={(event) => {
                  setJoinLinkInput(event.target.value);
                  if (joinError) {
                    setJoinError("");
                  }
                }}
                placeholder={t("joinGame.placeholder")}
                aria-label={t("joinGame.title")}
                className="flex-1"
              />
              <Button type="submit" className="sm:w-auto sm:shrink-0">
                {t("joinGame.button")}
              </Button>
            </form>
            {joinError ? (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {joinError}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-lg">{t("recentGames.title")}</CardTitle>
              <CardDescription className="mt-1">
                {t("recentGames.description")}
              </CardDescription>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/game-history")}>
              {t("recentGames.viewAll")}
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingRecent ? (
              <p className="text-sm text-muted-foreground">{t("recentGames.loading")}</p>
            ) : null}
            {recentError ? (
              <p className="text-sm text-red-600" role="alert">
                {recentError}
              </p>
            ) : null}
            {!loadingRecent && recentGames.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("recentGames.empty")}</p>
            ) : null}
            {recentGames.length > 0 ? (
              <ul className="space-y-2">
                {recentGames.map((game) => (
                  <li key={game.id}>
                    <button
                      type="button"
                      className="group flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-secondary/60"
                      onClick={() => navigate(`/game/${game.id}`)}
                    >
                      <span className="text-sm font-medium">{game.timeControl}</span>
                      <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 truncate">
                          <Trophy className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden />
                          <span className="truncate">
                            {game.status}
                            {game.result ? ` · ${game.result}` : ""}
                          </span>
                        </span>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
                          aria-hidden
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                  <GraduationCap className="h-5 w-5 text-primary" aria-hidden />
                </span>
                {t("myBookings.title")}
              </CardTitle>
              <CardDescription className="mt-1">{t("myBookings.description")}</CardDescription>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/coaches")}>
              {t("myBookings.browseCoaches")}
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingBookings ? (
              <p className="text-sm text-muted-foreground">{t("myBookings.loading")}</p>
            ) : null}
            {bookingsError ? (
              <p className="text-sm text-red-600" role="alert">
                {bookingsError}
              </p>
            ) : null}
            {!loadingBookings && coachBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("myBookings.empty")}</p>
            ) : null}
            {coachBookings.length > 0 ? (
              <ul className="space-y-2">
                {coachBookings.map((booking) => (
                  <li
                    key={booking.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-4 py-3"
                  >
                    <span className="truncate text-sm font-medium">
                      {booking.coach.name} {booking.coach.surname}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {formatDateTime(booking.slot.startTime)}
                      <Badge variant={bookingStatusVariant(booking.status)}>
                        {t(`myBookings.status.${booking.status}`, booking.status)}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
