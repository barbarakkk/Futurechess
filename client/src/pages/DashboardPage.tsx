import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ChevronRight,
  Crown,
  Flame,
  LayoutGrid,
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
import { api } from "../lib/api";
import { getApiErrorMessage } from "../lib/errors";
import { useAuthStore } from "../store/authStore";

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

export function DashboardPage() {
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
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDashboardData() {
      try {
        setLoadingRecent(true);
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
            "Could not load dashboard data.",
          );
          setRecentError(message);
          setStatsError(message);
        }
      } finally {
        if (mounted) {
          setLoadingRecent(false);
        }
      }
    }

    loadDashboardData();

    return () => {
      mounted = false;
    };
  }, []);

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
            Dashboard
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Welcome back,{" "}
              <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                {user?.username ?? "ChessPlayer"}
              </span>
            </h1>
            <p className="max-w-xl text-base text-muted-foreground">
              Pick a mode, review your stats, or jump into a recent game.
            </p>
          </div>
        </header>

        {statsError ? (
          <p className="text-sm text-red-400" role="alert">
            {statsError}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total games
              </CardTitle>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <LayoutGrid className="h-4 w-4 text-primary" aria-hidden />
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-3xl font-semibold tracking-tight">{stats.totalGames}</p>
              <Badge variant="secondary">All modes</Badge>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Win rate
              </CardTitle>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-3xl font-semibold tracking-tight">{stats.winRate}%</p>
              <Badge variant="outline">Completed games</Badge>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Current streak
              </CardTitle>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <Flame className="h-4 w-4 text-accent" aria-hidden />
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-3xl font-semibold tracking-tight">{stats.currentStreak}W</p>
              <Badge variant="secondary">Consecutive wins</Badge>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="overflow-hidden border-border/80 bg-gradient-to-br from-card/90 via-card/70 to-secondary/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                  <Swords className="h-5 w-5 text-primary" aria-hidden />
                </span>
                Play vs friend
              </CardTitle>
              <CardDescription>
                Realtime clocks, invite links, and server-validated moves.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Bullet</Badge>
                <Badge variant="outline">Blitz</Badge>
                <Badge variant="outline">Rapid</Badge>
                <Badge variant="outline">Classical</Badge>
              </div>
              <Button type="button" className="w-full" onClick={() => navigate("/new-game")}>
                Create game
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/80 bg-gradient-to-br from-card/90 via-card/70 to-accent/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                  <Crown className="h-5 w-5 text-accent" aria-hidden />
                </span>
                Play vs AI
              </CardTitle>
              <CardDescription>
                Adjustable strength — powered by Stockfish on the server.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Easy</Badge>
                <Badge variant="outline">Medium</Badge>
                <Badge variant="outline">Hard</Badge>
              </div>
              <Button
                type="button"
                variant="accent"
                className="w-full"
                onClick={() => navigate("/ai-game/new")}
              >
                Start AI game
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-lg">Recent games</CardTitle>
              <CardDescription className="mt-1">
                Continue a friend match from your latest activity.
              </CardDescription>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/game-history")}>
              View all
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingRecent ? (
              <p className="text-sm text-muted-foreground">Loading recent games...</p>
            ) : null}
            {recentError ? (
              <p className="text-sm text-red-400" role="alert">
                {recentError}
              </p>
            ) : null}
            {!loadingRecent && recentGames.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent games yet.</p>
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
      </section>
    </div>
  );
}
