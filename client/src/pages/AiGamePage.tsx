import { useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import {
  ChevronRight,
  Cpu,
  Gauge,
  Loader2,
  Palette,
  Sparkles,
  Timer,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { api } from "../lib/api";
import { getApiErrorMessage, getApiStatusCode } from "../lib/errors";
import { useAuthStore } from "../store/authStore";

type Difficulty = "easy" | "medium" | "hard";
type UserColor = "white" | "black";
type ColorChoice = UserColor | "random";

type AiMove = {
  color: "w" | "b";
  from: string;
  to: string;
  san: string;
  piece: string;
  promotion: string | null;
};

type AiGameState = {
  id: string;
  difficulty: Difficulty;
  userColor: UserColor;
  result: string | null;
  status: "ready" | "active" | "finished";
  fen: string;
  pgn: string;
  turn: "w" | "b";
  moves: AiMove[];
  createdAt: string;
  lastMove: AiMove | null;
};

function formatResult(result: string | null) {
  switch (result) {
    case "1-0":
      return "White won";
    case "0-1":
      return "Black won";
    case "1/2-1/2":
      return "Draw";
    default:
      return "In progress";
  }
}

export function AiGamePage() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const user = useAuthStore((state) => state.user);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [userColor, setUserColor] = useState<ColorChoice>("white");
  const [game, setGame] = useState<AiGameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [lastAction, setLastAction] = useState("");

  const isCreateMode = gameId === "new" || !gameId;
  const playerTurn = game?.turn === (game?.userColor === "white" ? "w" : "b");

  const statusText = useMemo(() => {
    if (!game) {
      return "";
    }

    if (game.result) {
      return `Game finished: ${formatResult(game.result)}`;
    }

    return playerTurn ? "Your move." : "Stockfish is to move.";
  }, [game, playerTurn]);

  useEffect(() => {
    if (isCreateMode || !gameId) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function fetchGame() {
      try {
        setLoading(true);
        const response = await api.get(`/ai-games/${gameId}`);
        if (mounted) {
          setGame(response.data.game);
          setError("");
          setLastAction("");
        }
      } catch (requestError: any) {
        if (mounted) {
          const statusCode = getApiStatusCode(requestError);
          setError(
            statusCode === 404
              ? "This AI game link is invalid or expired."
              : getApiErrorMessage(
                  requestError,
                  "Could not load AI game. It may not exist.",
                ),
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchGame();

    return () => {
      mounted = false;
    };
  }, [gameId, isCreateMode]);

  async function handleCreateGame() {
    try {
      setCreating(true);
      setError("");
      const resolvedColor: UserColor =
        userColor === "random"
          ? Math.random() > 0.5
            ? "white"
            : "black"
          : userColor;
      const response = await api.post("/ai-games", {
        difficulty,
        userColor: resolvedColor,
      });
      const createdGame = response.data.game as AiGameState;
      navigate(`/ai-game/${createdGame.id}`);
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, "Could not create AI game."));
    } finally {
      setCreating(false);
    }
  }

  async function handleMove(from: string, to: string, pieceType: string) {
    if (!game || acting || !playerTurn || Boolean(game.result)) {
      return false;
    }

    const promotion =
      pieceType.toLowerCase() === "wp" && to.endsWith("8")
        ? "q"
        : pieceType.toLowerCase() === "bp" && to.endsWith("1")
          ? "q"
          : undefined;

    try {
      setActing(true);
      setError("");
      const response = await api.post(`/ai-games/${game.id}/move`, {
        from,
        to,
        promotion,
      });
      const nextGame = response.data.game as AiGameState;
      const aiMove = response.data.aiMove as AiMove | null;
      setGame(nextGame);
      setLastAction(aiMove ? `Stockfish played ${aiMove.san}` : "No AI reply move.");
      return true;
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, "Move was rejected."));
      return false;
    } finally {
      setActing(false);
    }
  }

  if (isCreateMode) {
    return (
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-60" aria-hidden>
          <div className="absolute -right-12 top-0 h-[280px] w-[380px] rounded-full bg-accent/15 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-[220px] w-[340px] rounded-full bg-primary/10 blur-3xl" />
        </div>

        <section className="mx-auto max-w-2xl space-y-8">
          <header className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
              AI opponent
            </div>
            <div className="space-y-2">
              <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold tracking-tight md:text-4xl">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                  <Cpu className="h-5 w-5 text-accent" aria-hidden />
                </span>
                New AI game
              </h1>
              <p className="text-muted-foreground">
                Tune Stockfish strength and pick your side — one click to open the board.
              </p>
            </div>
          </header>

          <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Gauge className="h-5 w-5 text-primary" aria-hidden />
                Difficulty
              </CardTitle>
              <CardDescription>Select how aggressively Stockfish will search.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(["easy", "medium", "hard"] as Difficulty[]).map((level) => {
                const selected = difficulty === level;
                const label = level.charAt(0).toUpperCase() + level.slice(1);
                const hint =
                  level === "easy"
                    ? "Perfect for beginners"
                    : level === "medium"
                      ? "A balanced challenge"
                      : "For experienced players";
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      selected
                        ? "border-accent bg-accent/10 shadow-[0_0_0_1px_hsl(168_85%_33%_/_0.35)]"
                        : "border-border bg-background/50 hover:border-border hover:bg-secondary/60"
                    }`}
                  >
                    <div>
                      <p className="font-semibold">{label}</p>
                      <p className="text-sm text-muted-foreground">{hint}</p>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 ${selected ? "text-accent" : "text-muted-foreground"}`}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-5 w-5 text-primary" aria-hidden />
                Your color
              </CardTitle>
              <CardDescription>White moves first; as Black, Stockfish opens.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["white", "black", "random"] as ColorChoice[]).map((choice) => {
                  const selected = userColor === choice;
                  const label = choice.charAt(0).toUpperCase() + choice.slice(1);
                  const hint =
                    choice === "white"
                      ? "Play first"
                      : choice === "black"
                        ? "AI plays first"
                        : "Surprise me";
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setUserColor(choice)}
                      className={`rounded-xl border px-4 py-3 text-left transition ${
                        selected
                          ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(204_94%_54%_/_0.35)]"
                          : "border-border bg-background/50 hover:border-border hover:bg-secondary/60"
                      }`}
                    >
                      <p className="font-semibold">{label}</p>
                      <p className="text-sm text-muted-foreground">{hint}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            variant="accent"
            className="w-full sm:w-auto sm:min-w-[220px]"
            disabled={creating}
            onClick={handleCreateGame}
          >
            {creating ? "Creating AI game…" : "Start AI game"}
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-50" aria-hidden>
        <div className="absolute right-0 top-10 h-[260px] w-[400px] rounded-full bg-accent/12 blur-3xl" />
        <div className="absolute bottom-0 left-10 h-[220px] w-[320px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
            AI game
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">
                  <Cpu className="h-5 w-5 text-accent" aria-hidden />
                </span>
                vs Stockfish
              </h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">Game ID: {gameId}</p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading AI game...
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && game ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr] lg:items-start">
            <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Match</CardTitle>
                <CardDescription>Engine-backed — moves sync when you release a piece.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">You</span>
                  <span className="font-medium">
                    {user?.username ?? "You"} ({game.userColor})
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Opponent</span>
                  <span className="font-medium capitalize">Stockfish ({game.difficulty})</span>
                </div>
                <div className="flex items-start gap-2 border-t border-border pt-3">
                  <Timer className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>{statusText}</span>
                </div>
                <p className="border-t border-border pt-3 text-muted-foreground">
                  Result:{" "}
                  <span className="font-medium text-foreground">{formatResult(game.result)}</span>
                </p>
                {lastAction ? (
                  <p className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                    {lastAction}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/80 bg-card/80 p-4 backdrop-blur-sm">
              <div className="board-shell mx-auto w-full max-w-[560px]">
                <Chessboard
                  options={{
                    position: game.fen,
                    boardOrientation: game.userColor === "black" ? "black" : "white",
                    allowDragging: !acting && !game.result && playerTurn,
                    onPieceDrop: ({ sourceSquare, targetSquare, piece }) => {
                      if (!sourceSquare || !targetSquare) {
                        return false;
                      }

                      void handleMove(sourceSquare, targetSquare, piece.pieceType);
                      return false;
                    },
                  }}
                />
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
