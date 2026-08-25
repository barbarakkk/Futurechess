import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
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
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
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
import { useBoardTheme } from "../hooks/useBoardTheme";
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

function formatResult(result: string | null, t: TFunction) {
  switch (result) {
    case "1-0":
      return t("play.results.white");
    case "0-1":
      return t("play.results.black");
    case "1/2-1/2":
      return t("play.results.draw");
    default:
      return t("play.results.inProgress");
  }
}

type GameEndModalCopy = { title: string; body: string; kind: "win" | "loss" | "draw" };

// AI games have no "resign"/"timeout" mechanic (HTTP-only, no clocks) — the only endings are
// checkmate or a chess-rules draw, so this is simpler than FriendGamePage's equivalent.
function buildAiGameEndModalCopy(t: TFunction, userColor: UserColor, game: AiGameState): GameEndModalCopy {
  if (game.result === "1/2-1/2") {
    return { title: t("endModal.draw.title"), body: t("endModal.draw.body"), kind: "draw" };
  }

  const youWon = (userColor === "white" && game.result === "1-0") || (userColor === "black" && game.result === "0-1");

  let isCheckmate = false;
  try {
    const chess = new Chess();
    if (game.pgn) chess.loadPgn(game.pgn);
    isCheckmate = chess.isCheckmate();
  } catch {
    // Fall through to the generic copy below.
  }

  if (youWon) {
    return {
      title: t("endModal.win.title"),
      body: isCheckmate ? t("endModal.win.checkmate") : t("endModal.win.generic"),
      kind: "win",
    };
  }

  return {
    title: t("endModal.loss.title"),
    body: isCheckmate ? t("endModal.loss.checkmate") : t("endModal.loss.generic"),
    kind: "loss",
  };
}

// Bigger, more playful than an icon — matches how FriendGamePage's end-of-game modal reads.
const GAME_END_STICKERS: Record<GameEndModalCopy["kind"], string> = {
  win: "🏆",
  loss: "😢",
  draw: "🤝",
};

export function AiGamePage() {
  const { t } = useTranslation("aiGame");
  const navigate = useNavigate();
  const { gameId } = useParams();
  const user = useAuthStore((state) => state.user);
  const { lightSquareStyle, darkSquareStyle } = useBoardTheme();
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [userColor, setUserColor] = useState<ColorChoice>("white");
  const [game, setGame] = useState<AiGameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [lastAction, setLastAction] = useState("");
  const hasShownEndModal = useRef(false);
  const [gameEndModal, setGameEndModal] = useState<GameEndModalCopy | null>(null);

  const isCreateMode = gameId === "new" || !gameId;
  const playerTurn = game?.turn === (game?.userColor === "white" ? "w" : "b");

  const statusText = useMemo(() => {
    if (!game) {
      return "";
    }

    if (game.result) {
      return t("play.match.finished", { result: formatResult(game.result, t) });
    }

    return playerTurn ? t("play.match.yourTurn") : t("play.match.aiTurn");
  }, [game, playerTurn, t]);

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
              ? t("play.notFoundError")
              : getApiErrorMessage(requestError, t("play.loadError")),
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
  }, [gameId, isCreateMode, t]);

  useEffect(() => {
    hasShownEndModal.current = false;
    setGameEndModal(null);
  }, [gameId]);

  useEffect(() => {
    if (!game || game.status !== "finished" || !game.result) {
      return;
    }
    if (hasShownEndModal.current) {
      return;
    }
    hasShownEndModal.current = true;
    setGameEndModal(buildAiGameEndModalCopy(t, game.userColor, game));
    // t intentionally omitted: this should run once per finished game, not re-fire on language change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  useEffect(() => {
    if (!gameEndModal) {
      return;
    }
    const timer = window.setTimeout(() => {
      navigate("/dashboard", { replace: true });
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [gameEndModal, navigate]);

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
      setError(getApiErrorMessage(requestError, t("setup.createError")));
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

    // Apply the move locally first so the board updates the instant the piece is
    // dropped — otherwise it would wait for the server response, which only comes
    // back after Stockfish has finished thinking. chess.js enforces the same rules
    // the server does; the server response below is still authoritative.
    const optimistic = new Chess();
    try {
      if (game.pgn) {
        optimistic.loadPgn(game.pgn);
      }
      optimistic.move({ from, to, promotion });
    } catch {
      return false; // illegal move — let the board snap the piece back
    }

    const previousGame = game;
    setGame({
      ...game,
      fen: optimistic.fen(),
      pgn: optimistic.pgn(),
      turn: optimistic.turn(),
    });

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
      setLastAction(
        aiMove
          ? t("play.match.aiPlayed", { san: aiMove.san })
          : t("play.match.noAiReply"),
      );
      return true;
    } catch (requestError: any) {
      setGame(previousGame); // server rejected — roll back the optimistic move
      setError(getApiErrorMessage(requestError, t("play.moveRejectedError")));
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
              {t("setup.badge")}
            </div>
            <div className="space-y-2">
              <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold tracking-tight md:text-4xl">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                  <Cpu className="h-5 w-5 text-accent" aria-hidden />
                </span>
                {t("setup.title")}
              </h1>
              <p className="text-muted-foreground">{t("setup.subtitle")}</p>
            </div>
          </header>

          <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Gauge className="h-5 w-5 text-primary" aria-hidden />
                {t("setup.difficulty.title")}
              </CardTitle>
              <CardDescription>{t("setup.difficulty.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(["easy", "medium", "hard"] as Difficulty[]).map((level) => {
                const selected = difficulty === level;
                const label = t(`setup.difficulty.${level}.label`);
                const hint = t(`setup.difficulty.${level}.hint`);
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      selected
                        ? "border-accent bg-accent/10 shadow-[0_0_0_1px_hsl(199_89%_48%_/_0.35)]"
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
                {t("setup.color.title")}
              </CardTitle>
              <CardDescription>{t("setup.color.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["white", "black", "random"] as ColorChoice[]).map((choice) => {
                  const selected = userColor === choice;
                  const label = t(`setup.color.${choice}.label`);
                  const hint = t(`setup.color.${choice}.hint`);
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setUserColor(choice)}
                      className={`rounded-xl border px-4 py-3 text-left transition ${
                        selected
                          ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(211_100%_50%_/_0.35)]"
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
            <p className="text-sm text-red-600" role="alert">
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
            {creating ? t("setup.startingButton") : t("setup.startButton")}
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
            {t("play.badge")}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">
                  <Cpu className="h-5 w-5 text-accent" aria-hidden />
                </span>
                {t("play.title")}
              </h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {t("play.gameId", { id: gameId })}
              </p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t("play.loading")}
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && game ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr] lg:items-start">
            <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("play.match.title")}</CardTitle>
                <CardDescription>{t("play.match.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("play.match.you")}</span>
                  <span className="font-medium">
                    {user?.username ?? t("play.match.you")} (
                    {t(`setup.color.${game.userColor}.label`)})
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("play.match.opponent")}</span>
                  <span className="font-medium">
                    {t("play.match.opponentName", {
                      difficulty: t(`setup.difficulty.${game.difficulty}.label`),
                    })}
                  </span>
                </div>
                <div className="flex items-start gap-2 border-t border-border pt-3">
                  <Timer className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>{statusText}</span>
                </div>
                <p className="border-t border-border pt-3 text-muted-foreground">
                  {t("play.match.result")}{" "}
                  <span className="font-medium text-foreground">
                    {formatResult(game.result, t)}
                  </span>
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
                    lightSquareStyle,
                    darkSquareStyle,
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

      {gameEndModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-blue-900/30 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-game-end-title"
          aria-describedby="ai-game-end-desc"
        >
          <Card className="w-full max-w-md border-border/80 bg-card shadow-2xl">
            <CardHeader className="space-y-3 text-center sm:text-left">
              <div className="flex justify-center text-5xl sm:justify-start" aria-hidden>
                {GAME_END_STICKERS[gameEndModal.kind]}
              </div>
              <CardTitle id="ai-game-end-title" className="text-2xl">
                {gameEndModal.title}
              </CardTitle>
              <CardDescription
                id="ai-game-end-desc"
                className="text-base leading-relaxed text-foreground/90"
              >
                {gameEndModal.body}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-xs text-muted-foreground sm:text-left">
                {t("endModal.returning")}
              </p>
              <Button
                type="button"
                className="w-full"
                onClick={() => navigate("/dashboard", { replace: true })}
              >
                {t("endModal.backToDashboard")}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
