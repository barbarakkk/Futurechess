import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ChevronRight,
  History,
  Loader2,
  Minus,
  Sparkles,
  Swords,
  Target,
  Trash2,
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

type HistoryOutcome = "win" | "loss" | "draw" | "ongoing" | "waiting";

type HistoryGame = {
  id: string;
  timeControl: string;
  status: string;
  result: string | null;
  startedAt: string | null;
  endedAt: string | null;
  yourColor: "white" | "black";
  opponent: { id: string; username: string } | null;
  outcome: HistoryOutcome;
};

type HistorySummary = {
  total: number;
  wins: number;
  losses: number;
  draws: number;
  ongoing: number;
};

function formatWhen(iso: string | null) {
  if (!iso) {
    return "—";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function OutcomeBadge({ outcome }: { outcome: HistoryOutcome }) {
  if (outcome === "win") {
    return <Badge className="bg-emerald-600/25 text-emerald-200 hover:bg-emerald-600/30">Win</Badge>;
  }
  if (outcome === "loss") {
    return <Badge className="bg-red-600/20 text-red-200 hover:bg-red-600/25">Loss</Badge>;
  }
  if (outcome === "draw") {
    return <Badge variant="secondary">Draw</Badge>;
  }
  if (outcome === "waiting") {
    return <Badge variant="outline">Waiting</Badge>;
  }
  return <Badge variant="outline">In progress</Badge>;
}

export function GameHistoryPage() {
  const [games, setGames] = useState<HistoryGame[]>([]);
  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<HistoryGame | null>(null);

  const refreshHistory = useCallback(async () => {
    const response = await api.get("/games/history");
    setGames(response.data.games ?? []);
    setSummary(response.data.summary ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const response = await api.get("/games/history");
        if (mounted) {
          setGames(response.data.games ?? []);
          setSummary(response.data.summary ?? null);
        }
      } catch (requestError: any) {
        if (mounted) {
          setError(getApiErrorMessage(requestError, "Could not load game history."));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  function openDeleteConfirm(game: HistoryGame) {
    if (game.outcome === "ongoing") {
      return;
    }
    setPendingDelete(game);
    setError("");
  }

  function closeDeleteConfirm() {
    if (deletingId) {
      return;
    }
    setPendingDelete(null);
  }

  async function executeDelete() {
    if (!pendingDelete) {
      return;
    }
    const game = pendingDelete;
    setDeletingId(game.id);
    setError("");
    try {
      await api.delete(`/games/${game.id}`);
      setPendingDelete(null);
      await refreshHistory();
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, "Could not remove this game from your history."));
    } finally {
      setDeletingId(null);
    }
  }

  const completed = summary
    ? summary.wins + summary.losses + summary.draws
    : 0;
  const winRate =
    completed > 0 && summary
      ? Math.round((summary.wins / completed) * 100)
      : 0;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-40" aria-hidden>
        <div className="absolute left-0 top-20 h-[200px] w-[320px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-[180px] w-[280px] rounded-full bg-accent/10 blur-3xl" />
      </div>

      <section className="space-y-8">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            Friend games
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
              <History className="h-6 w-6 text-primary" aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Game history</h1>
              <p className="text-sm text-muted-foreground">
                Your results against opponents in real-time friend games.
              </p>
            </div>
          </div>
        </header>

        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading history…
          </div>
        ) : null}

        {!loading && summary ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
                  <Swords className="h-3.5 w-3.5" aria-hidden />
                  Record
                </CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {summary.wins}W — {summary.losses}L — {summary.draws}D
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                {completed} finished
                {summary.ongoing > 0 ? ` · ${summary.ongoing} open` : null}
              </CardContent>
            </Card>
            <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
                  <Target className="h-3.5 w-3.5" aria-hidden />
                  Win rate
                </CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {completed > 0 ? `${winRate}%` : "—"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                From completed friend games
              </CardContent>
            </Card>
            <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">
                  Wins
                </CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums text-emerald-200/90">
                  {summary.wins}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">
                  Losses
                </CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums text-red-200/90">
                  {summary.losses}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        ) : null}

        {!loading && !error && games.length === 0 ? (
          <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              <Minus className="mx-auto mb-2 h-8 w-8 opacity-50" aria-hidden />
              No friend games yet. Create a game from the menu and share the link.
            </CardContent>
          </Card>
        ) : null}

        {!loading && games.length > 0 ? (
          <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">All games</CardTitle>
              <CardDescription>
                Newest first. Open to review the board, or remove a finished or waiting game from{" "}
                <strong className="font-medium text-foreground">your</strong> history only — your
                opponent&apos;s list is unchanged (finished or waiting games only — not games still in
                progress).
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0 sm:p-6 sm:pt-0">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 sm:px-0">Date</th>
                    <th className="px-4 py-3 sm:px-0">Opponent</th>
                    <th className="px-4 py-3 sm:px-0">You</th>
                    <th className="px-4 py-3 sm:px-0">Clock</th>
                    <th className="px-4 py-3 sm:px-0">Result</th>
                    <th className="px-4 py-3 sm:px-0">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((g) => (
                    <tr
                      key={g.id}
                      className="border-b border-border/60 last:border-0 hover:bg-secondary/30"
                    >
                      <td className="px-4 py-3 align-middle text-muted-foreground sm:px-0">
                        {formatWhen(g.endedAt || g.startedAt)}
                      </td>
                      <td className="px-4 py-3 align-middle font-medium sm:px-0">
                        {g.opponent?.username ?? "—"}
                        {g.outcome === "waiting" ? (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            (not joined)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-middle capitalize text-muted-foreground sm:px-0">
                        {g.yourColor}
                      </td>
                      <td className="px-4 py-3 align-middle sm:px-0">{g.timeControl}</td>
                      <td className="px-4 py-3 align-middle sm:px-0">
                        <OutcomeBadge outcome={g.outcome} />
                      </td>
                      <td className="px-4 py-3 align-middle sm:px-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/game/${g.id}`}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-primary hover:bg-secondary hover:text-primary"
                          >
                            Open
                            <ChevronRight className="h-4 w-4" aria-hidden />
                          </Link>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-red-400 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-40"
                            disabled={
                              deletingId === g.id ||
                              g.outcome === "ongoing"
                            }
                            title={
                              g.outcome === "ongoing"
                                ? "Finish or resign before you can remove this game from your history."
                                : "Remove this game from your history only (your opponent still sees it)"
                            }
                            aria-label={`Remove game ${g.id} from your history`}
                            onClick={() => openDeleteConfirm(g)}
                          >
                            {deletingId === g.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="h-4 w-4" aria-hidden />
                            )}
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : null}
      </section>

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget && !deletingId) {
              closeDeleteConfirm();
            }
          }}
        >
          <Card
            className="relative w-full max-w-md border-border/80 bg-card shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-game-title"
            aria-describedby="delete-game-desc"
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader className="space-y-3">
              <div className="flex justify-center sm:justify-start">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-950/50 text-red-300">
                  <AlertTriangle className="h-6 w-6" aria-hidden />
                </span>
              </div>
              <CardTitle id="delete-game-title" className="text-xl">
                Remove from your history?
              </CardTitle>
              <CardDescription
                id="delete-game-desc"
                className="text-base leading-relaxed text-foreground/90"
              >
                This removes the match from <strong className="font-semibold text-foreground">your</strong>{" "}
                history only. Your opponent&apos;s history, stats, and saved game data are not affected.
                You won&apos;t be able to restore it to your list later.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={Boolean(deletingId)}
                onClick={closeDeleteConfirm}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="w-full gap-2 bg-red-600 text-white hover:bg-red-700 sm:w-auto"
                disabled={Boolean(deletingId)}
                onClick={() => void executeDelete()}
              >
                {deletingId === pendingDelete.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Removing…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Remove from my history
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
