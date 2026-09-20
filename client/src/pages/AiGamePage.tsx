import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  ArrowUpDown,
  ChevronRight,
  Cpu,
  Flag,
  Gauge,
  Handshake,
  Loader2,
  Palette,
  Sparkles,
  Timer,
  X,
  Zap,
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
import { MoveList } from "../components/game/MoveList";
import { PlayerStrip } from "../components/game/PlayerStrip";
import { api } from "../lib/api";
import { BOARD_NOTATION_OPTIONS } from "../lib/boardThemes";
import { getCaptureSummary } from "../lib/chessCaptures";
import { isPremoveLegal, PREMOVE_ARROW_COLOR, PREMOVE_SQUARE_STYLE, type Premove } from "../lib/premove";
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

// AI games have no clocks (HTTP-only) — endings are checkmate, a chess-rules draw, resignation or an
// accepted draw offer. The last two can't be inferred from the PGN, so callers pass `endedBy`.
function buildAiGameEndModalCopy(
  t: TFunction,
  userColor: UserColor,
  game: AiGameState,
  endedBy: "resign" | "drawAgreed" | null = null,
): GameEndModalCopy {
  if (endedBy === "resign") {
    return { title: t("endModal.resign.title"), body: t("endModal.resign.body"), kind: "loss" };
  }
  if (endedBy === "drawAgreed") {
    return { title: t("endModal.drawAgreed.title"), body: t("endModal.drawAgreed.body"), kind: "draw" };
  }
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
  const [flipped, setFlipped] = useState(false);
  const [confirmingResign, setConfirmingResign] = useState(false);
  const [actionNote, setActionNote] = useState("");
  const [premove, setPremove] = useState<Premove | null>(null);
  const endedBy = useRef<"resign" | "drawAgreed" | null>(null);

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

  const statusHint = useMemo(() => {
    if (!game || game.result) {
      return "";
    }
    if (!playerTurn) {
      return t("play.aiTurnHint");
    }
    try {
      const chess = new Chess(game.fen);
      return chess.inCheck() ? t("play.inCheckHint") : t("play.yourTurnHint");
    } catch {
      return t("play.yourTurnHint");
    }
  }, [game, playerTurn, t]);

  const captures = useMemo(() => getCaptureSummary(game?.fen ?? ""), [game?.fen]);

  const userIsWhite = game?.userColor === "white";
  const aiThinking = Boolean(game && acting && !game.result && !playerTurn);
  const whiteAtBottom = userIsWhite !== flipped;
  const boardOrientation: "white" | "black" = whiteAtBottom ? "white" : "black";
  const topColor: "w" | "b" = boardOrientation === "white" ? "b" : "w";
  const bottomColor: "w" | "b" = topColor === "w" ? "b" : "w";
  const userSide: "w" | "b" = userIsWhite ? "w" : "b";
  const topIsYou = topColor === userSide;
  const bottomIsYou = bottomColor === userSide;
  const sideLabel = (color: "w" | "b") => t(`setup.color.${color === "w" ? "white" : "black"}.label`);
  const topSubtitle = topIsYou
    ? `${sideLabel(topColor)} · ${t("play.match.you")}`
    : `${sideLabel(topColor)} · ${t(`setup.difficulty.${game?.difficulty ?? "medium"}.label`)}`;
  const bottomSubtitle = bottomIsYou
    ? `${sideLabel(bottomColor)} · ${t("play.match.you")}`
    : `${sideLabel(bottomColor)} · ${t(`setup.difficulty.${game?.difficulty ?? "medium"}.label`)}`;

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
    endedBy.current = null;
    setGameEndModal(null);
    setFlipped(false);
    setConfirmingResign(false);
    setActionNote("");
    setPremove(null);
  }, [gameId]);

  useEffect(() => {
    if (!game || game.status !== "finished" || !game.result) {
      return;
    }
    if (hasShownEndModal.current) {
      return;
    }
    hasShownEndModal.current = true;
    setGameEndModal(buildAiGameEndModalCopy(t, game.userColor, game, endedBy.current));
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

  async function handleResign() {
    if (!game || acting || game.result) {
      return;
    }
    try {
      setActing(true);
      setError("");
      const response = await api.post(`/ai-games/${game.id}/resign`);
      endedBy.current = "resign";
      setConfirmingResign(false);
      setGame(response.data.game as AiGameState);
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, t("play.actions.resignError")));
    } finally {
      setActing(false);
    }
  }

  async function handleOfferDraw() {
    if (!game || acting || game.result) {
      return;
    }
    try {
      setActing(true);
      setError("");
      setActionNote("");
      const response = await api.post(`/ai-games/${game.id}/draw`);
      if (response.data.accepted) {
        endedBy.current = "drawAgreed";
      } else {
        setActionNote(t("play.actions.drawDeclined"));
      }
      setGame(response.data.game as AiGameState);
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, t("play.actions.drawError")));
    } finally {
      setActing(false);
    }
  }

  const canPremove = Boolean(game) && !game?.result && !playerTurn;

  // A queued premove is dropped once the game is over, and Esc cancels it.
  useEffect(() => {
    if (premove && game?.result) {
      setPremove(null);
    }
  }, [premove, game?.result]);

  useEffect(() => {
    if (!premove) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPremove(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [premove]);

  // Fires a beat after Stockfish's reply lands so you still see it. Re-validated against the real
  // position here; the server validates it again on /move.
  useEffect(() => {
    if (!premove || !game || game.result || !playerTurn || acting) {
      return;
    }
    const timer = window.setTimeout(() => {
      setPremove(null);
      try {
        const chess = new Chess(game.fen);
        const legal = chess
          .moves({ square: premove.from as Square, verbose: true })
          .some((move) => move.to === premove.to);
        const piece = chess.get(premove.from as Square);
        if (legal && piece) {
          void handleMove(premove.from, premove.to, `${piece.color}${piece.type}`);
          return;
        }
      } catch {
        // Fall through to the cancelled message below.
      }
      setActionNote(t("play.premove.cancelledIllegal"));
    }, 180);
    return () => window.clearTimeout(timer);
    // handleMove/t intentionally omitted: re-arm only when the position or premove changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premove, playerTurn, acting, game?.fen]);

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
      setActionNote("");
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
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <section className="mx-auto grid w-full max-w-[640px] gap-2" aria-label={t("play.title")}>
              <PlayerStrip
                name={topIsYou ? (user?.username ?? t("play.match.you")) : "Stockfish"}
                subtitle={topSubtitle}
                isYou={topIsYou}
                isTurn={!game.result && game.turn === topColor}
                thinking={!topIsYou && aiThinking}
                thinkingLabel={t("play.thinking")}
                captured={captures.capturedBy[topColor]}
                lead={captures.lead[topColor]}
              />
              <Card className="overflow-hidden border-border/80 bg-card/80 p-2 backdrop-blur-sm">
                <div className="board-shell mx-auto w-full">
                  <Chessboard
                    options={{
                      position: game.fen,
                      boardOrientation,
                      lightSquareStyle,
                      darkSquareStyle,
                      ...BOARD_NOTATION_OPTIONS,
                      // Own pieces stay draggable while Stockfish thinks: that drop queues a premove.
                      allowDragging: (!acting && !game.result && playerTurn) || canPremove,
                      canDragPiece: ({ piece }) => piece.pieceType[0].toLowerCase() === userSide,
                      squareStyles: premove
                        ? { [premove.from]: PREMOVE_SQUARE_STYLE, [premove.to]: PREMOVE_SQUARE_STYLE }
                        : {},
                      arrows: premove
                        ? [{ startSquare: premove.from, endSquare: premove.to, color: PREMOVE_ARROW_COLOR }]
                        : [],
                      // Clicking the board cancels a queued premove.
                      onSquareClick: () => {
                        if (premove) {
                          setPremove(null);
                        }
                      },
                      onPieceDrop: ({ sourceSquare, targetSquare, piece }) => {
                        if (!sourceSquare || !targetSquare) {
                          return false;
                        }

                        if (playerTurn) {
                          void handleMove(sourceSquare, targetSquare, piece.pieceType);
                        } else if (canPremove && isPremoveLegal(game.fen, userSide, sourceSquare, targetSquare)) {
                          setPremove({ from: sourceSquare, to: targetSquare });
                        }
                        return false;
                      },
                    }}
                  />
                </div>
              </Card>
              <PlayerStrip
                name={bottomIsYou ? (user?.username ?? t("play.match.you")) : "Stockfish"}
                subtitle={bottomSubtitle}
                isYou={bottomIsYou}
                isTurn={!game.result && game.turn === bottomColor}
                thinking={!bottomIsYou && aiThinking}
                thinkingLabel={t("play.thinking")}
                captured={captures.capturedBy[bottomColor]}
                lead={captures.lead[bottomColor]}
              />
              {game.result ? null : (
                <div className="flex min-h-9 items-center px-1" aria-live="polite">
                  {premove ? (
                    <div className="flex w-full items-center gap-2 rounded-lg bg-blue-600/10 px-3 py-1.5 text-sm text-blue-700">
                      <Zap className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="font-semibold">{t("play.premove.label")}</span>
                      <span className="font-mono">
                        {premove.from} → {premove.to}
                      </span>
                      <span className="hidden text-xs text-blue-700/70 sm:inline">
                        {t("play.premove.playsOnReply")}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPremove(null)}
                        className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold hover:bg-blue-600/15"
                        aria-label={t("play.premove.cancelAria")}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                        {t("play.premove.cancel")}
                      </button>
                    </div>
                  ) : canPremove ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {t("play.premove.hint")}
                    </p>
                  ) : null}
                </div>
              )}
            </section>

            <aside className="grid gap-4">
              <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-accent">
                      <Timer className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <p className="font-semibold leading-tight">{statusText}</p>
                      <p className="text-sm text-muted-foreground">{statusHint}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-xl bg-secondary/60 px-3 py-2">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("play.level")}
                      </dt>
                      <dd className="font-semibold">{t(`setup.difficulty.${game.difficulty}.label`)}</dd>
                    </div>
                    <div className="rounded-xl bg-secondary/60 px-3 py-2">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("play.match.you")}
                      </dt>
                      <dd className="font-semibold">{t(`setup.color.${game.userColor}.label`)}</dd>
                    </div>
                    <div className="rounded-xl bg-secondary/60 px-3 py-2">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("play.moveNumber")}
                      </dt>
                      <dd className="font-semibold">{Math.floor(game.moves.length / 2) + 1}</dd>
                    </div>
                  </dl>
                  {lastAction ? (
                    <p className="rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">{lastAction}</p>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>{t("play.moves.title")}</span>
                    {game.moves.length ? <span>{t("play.moves.ply", { count: game.moves.length })}</span> : null}
                  </div>
                  <MoveList sans={game.moves.map((move) => move.san)} emptyLabel={t("play.moves.empty")} />
                </CardContent>
              </Card>

              <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
                <CardContent className="space-y-3 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("play.actions.title")}
                  </p>
                  {confirmingResign && !game.result ? (
                    <div
                      className="space-y-3 rounded-xl bg-red-50 p-3 text-red-900"
                      role="alertdialog"
                      aria-label={t("play.actions.resign")}
                    >
                      <p className="text-sm font-medium">{t("play.actions.resignPrompt")}</p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setConfirmingResign(false)}
                        >
                          {t("play.actions.keepPlaying")}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                          disabled={acting}
                          onClick={handleResign}
                        >
                          {t("play.actions.confirmResign")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="danger"
                        disabled={acting || Boolean(game.result)}
                        onClick={() => {
                          setActionNote("");
                          setConfirmingResign(true);
                        }}
                      >
                        <Flag className="mr-2 h-4 w-4" aria-hidden />
                        {t("play.actions.resign")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={acting || Boolean(game.result)}
                        onClick={handleOfferDraw}
                      >
                        <Handshake className="mr-2 h-4 w-4" aria-hidden />
                        {t("play.actions.offerDraw")}
                      </Button>
                    </div>
                  )}
                  {actionNote ? (
                    <p className="rounded-lg bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">{actionNote}</p>
                  ) : null}
                  <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setFlipped((v) => !v)}>
                    <ArrowUpDown className="mr-2 h-4 w-4" aria-hidden />
                    {t("play.flip")}
                  </Button>
                </CardContent>
              </Card>
            </aside>
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
