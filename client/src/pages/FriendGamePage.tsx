import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  Check,
  Clock,
  Copy,
  Link2,
  Loader2,
  Share2,
  Swords,
  Timer,
  Users,
  WifiOff,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { io, type Socket } from "socket.io-client";
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
import { getApiErrorMessage, getApiStatusCode } from "../lib/errors";
import { useBoardTheme } from "../hooks/useBoardTheme";
import { useAuthStore } from "../store/authStore";

type PlayerSummary = {
  id: string;
  username: string;
};

type GameSummary = {
  id: string;
  timeControl: string;
  status: string;
  result: string | null;
  startedAt: string | null;
  endedAt: string | null;
  whitePlayerId: string | null;
  blackPlayerId: string | null;
  players: {
    white: PlayerSummary | null;
    black: PlayerSummary | null;
  };
  fen: string;
  pgn: string;
  turn: "w" | "b";
  isCheck: boolean;
  clocks: {
    whiteMs: number;
    blackMs: number;
  };
  drawOfferBy: "w" | "b" | null;
  terminalReason: string | null;
  serverNow: string;
};

type GameEventAck = {
  ok: boolean;
  message?: string;
  game?: GameSummary;
  playerColor?: "w" | "b" | null;
};

function formatClock(totalMs: number) {
  const clamped = Math.max(0, Math.floor(totalMs / 1000));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Owns its own 250ms ticker so the countdown re-renders in isolation — the parent
// page (and the expensive <Chessboard>) no longer re-render 4x/second. Only the
// side whose turn it is actually ticks; a stopped clock renders its frozen value.
function LiveClock({
  side,
  status,
  result,
  turn,
  serverNow,
  clockMs,
}: {
  side: "w" | "b";
  status: string;
  result: string | null;
  turn: "w" | "b";
  serverNow: string;
  clockMs: number;
}) {
  const isRunning = status === "active" && !result && turn === side;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isRunning) {
      return;
    }
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  const elapsed = isRunning ? Math.max(0, now - new Date(serverNow).getTime()) : 0;
  return <>{formatClock(Math.max(0, clockMs - elapsed))}</>;
}

type TFn = (key: string, options?: Record<string, unknown>) => string;

// Converts a server terminalReason like "draw-agreement" into the
// matching camelCase translation key "drawAgreement".
function reasonTranslationKey(reason: string) {
  return reason.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

// Bigger, more playful than an icon.
const GAME_END_STICKERS: Record<"win" | "loss" | "draw", string> = {
  win: "🏆",
  loss: "😢",
  draw: "🤝",
};

function formatResult(result: string | null, t: TFn) {
  switch (result) {
    case "1-0":
      return t("result.whiteWon");
    case "0-1":
      return t("result.blackWon");
    case "1/2-1/2":
      return t("result.draw");
    default:
      return t("result.inProgress");
  }
}

function buildGameEndModalCopy(
  t: TFn,
  localColor: "w" | "b",
  g: GameSummary,
): { title: string; body: string; kind: "win" | "loss" | "draw" } {
  const { result, terminalReason, players } = g;
  if (!result) {
    return { title: t("endModal.gameOver"), body: "", kind: "draw" };
  }

  const opponentLabel =
    (localColor === "w" ? players.black?.username : players.white?.username) ??
    t("endModal.opponentFallback");

  if (result === "1/2-1/2") {
    if (terminalReason === "draw-agreement") {
      return {
        title: t("endModal.draw.title"),
        body: t("endModal.draw.agreement"),
        kind: "draw",
      };
    }
    if (terminalReason === "draw") {
      return {
        title: t("endModal.draw.title"),
        body: t("endModal.draw.rule"),
        kind: "draw",
      };
    }
    return {
      title: t("endModal.draw.title"),
      body: t("endModal.draw.generic"),
      kind: "draw",
    };
  }

  const youWon =
    (localColor === "w" && result === "1-0") ||
    (localColor === "b" && result === "0-1");

  if (youWon) {
    switch (terminalReason) {
      case "resign":
        return {
          title: t("endModal.win.title"),
          body: t("endModal.win.resign", { opponent: opponentLabel }),
          kind: "win",
        };
      case "checkmate":
        return {
          title: t("endModal.win.title"),
          body: t("endModal.win.checkmate"),
          kind: "win",
        };
      case "timeout":
        return {
          title: t("endModal.win.title"),
          body: t("endModal.win.timeout", { opponent: opponentLabel }),
          kind: "win",
        };
      default:
        return {
          title: t("endModal.win.title"),
          body: t("endModal.win.generic"),
          kind: "win",
        };
    }
  }

  switch (terminalReason) {
    case "resign":
      return {
        title: t("endModal.loss.resignTitle"),
        body: t("endModal.loss.resignBody", { opponent: opponentLabel }),
        kind: "loss",
      };
    case "checkmate":
      return {
        title: t("endModal.loss.checkmateTitle"),
        body: t("endModal.loss.checkmateBody"),
        kind: "loss",
      };
    case "timeout":
      return {
        title: t("endModal.loss.timeoutTitle"),
        body: t("endModal.loss.timeoutBody"),
        kind: "loss",
      };
    default:
      return {
        title: t("endModal.gameOver"),
        body: t("endModal.loss.genericBody"),
        kind: "loss",
      };
  }
}

export function FriendGamePage() {
  const { t } = useTranslation("friendGame");
  const navigate = useNavigate();
  const { gameId } = useParams();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const { lightSquareStyle, darkSquareStyle } = useBoardTheme();
  const [game, setGame] = useState<GameSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const [moveHint, setMoveHint] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idCopyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFenForMoveHint = useRef<string | null>(null);
  const hasShownEndModal = useRef(false);
  const [gameEndModal, setGameEndModal] = useState<{
    title: string;
    body: string;
    kind: "win" | "loss" | "draw";
  } | null>(null);

  const localColor = useMemo(() => {
    if (!game || !user) {
      return null;
    }

    if (game.whitePlayerId === user.id) {
      return "w";
    }

    if (game.blackPlayerId === user.id) {
      return "b";
    }

    return null;
  }, [game, user]);

  const canMove =
    Boolean(game) &&
    game?.status === "active" &&
    !game?.result &&
    Boolean(localColor) &&
    game?.turn === localColor;

  const drawOfferForPlayer =
    game?.drawOfferBy && localColor && game.drawOfferBy !== localColor;

  const shareLink =
    typeof window !== "undefined" && gameId
      ? `${window.location.origin}/game/${gameId}`
      : "";

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function handleCopyInviteLink() {
    if (!shareLink) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareLink);
      setLinkCopied(true);
      if (copyFeedbackTimerRef.current) {
        clearTimeout(copyFeedbackTimerRef.current);
      }
      copyFeedbackTimerRef.current = setTimeout(() => {
        setLinkCopied(false);
        copyFeedbackTimerRef.current = null;
      }, 2000);
    } catch {
      setError(t("errors.copyFailed"));
    }
  }

  async function handleCopyGameId() {
    if (!gameId) {
      return;
    }
    try {
      await navigator.clipboard.writeText(gameId);
      setIdCopied(true);
      if (idCopyFeedbackTimerRef.current) {
        clearTimeout(idCopyFeedbackTimerRef.current);
      }
      idCopyFeedbackTimerRef.current = setTimeout(() => {
        setIdCopied(false);
        idCopyFeedbackTimerRef.current = null;
      }, 2000);
    } catch {
      setError(t("errors.copyFailed"));
    }
  }

  async function handleShareInvite() {
    if (!shareLink || !canNativeShare) {
      return;
    }
    try {
      await navigator.share({ title: t("invite.shareTitle"), url: shareLink });
    } catch {
      // User dismissed the native share sheet, or the platform declined — not an error worth surfacing.
    }
  }

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current) {
        clearTimeout(copyFeedbackTimerRef.current);
      }
      if (idCopyFeedbackTimerRef.current) {
        clearTimeout(idCopyFeedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!game?.fen) {
      return;
    }
    if (
      lastFenForMoveHint.current !== null &&
      lastFenForMoveHint.current !== game.fen
    ) {
      setMoveHint("");
    }
    lastFenForMoveHint.current = game.fen;
  }, [game?.fen]);

  useEffect(() => {
    if (!moveHint) {
      return;
    }
    const timer = window.setTimeout(() => setMoveHint(""), 12_000);
    return () => window.clearTimeout(timer);
  }, [moveHint]);

  useEffect(() => {
    hasShownEndModal.current = false;
    setGameEndModal(null);
  }, [gameId]);

  useEffect(() => {
    if (!game || !user || !localColor) {
      return;
    }
    if (game.status !== "finished" || !game.result) {
      return;
    }
    if (hasShownEndModal.current) {
      return;
    }
    hasShownEndModal.current = true;
    setGameEndModal(buildGameEndModalCopy(t, localColor, game));
    // t intentionally omitted: this should run once per finished game, not re-fire on language change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, user, localColor]);

  useEffect(() => {
    if (!gameEndModal) {
      return;
    }
    const t = window.setTimeout(() => {
      navigate("/dashboard", { replace: true });
    }, 5000);
    return () => window.clearTimeout(t);
  }, [gameEndModal, navigate]);

  useEffect(() => {
    if (!gameId || !token) {
      return;
    }

    let mounted = true;
    async function joinAndLoad() {
      try {
        setLoading(true);
        await api.post(`/games/${gameId}/join`);
        const response = await api.get(`/games/${gameId}`);

        if (mounted) {
          setGame(response.data.game);
          setError("");
        }

        socketRef.current = io(api.defaults.baseURL as string, {
          auth: { token },
          // Skip the HTTP long-polling handshake and connect straight over WebSocket —
          // shaves a round trip off every (re)connect, which matters when the clock is running.
          transports: ["websocket"],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 800,
          reconnectionDelayMax: 3000,
        });

        socketRef.current.on("connect", () => {
          if (!mounted) {
            return;
          }

          setReconnecting(false);
          socketRef.current?.emit("game:join", { gameId }, (ack: GameEventAck) => {
            if (ack.ok !== true && ack.message) {
              setError(ack.message);
            }

            if (ack.game) {
              setGame(ack.game);
            }
          });
        });

        socketRef.current.on("reconnect_attempt", () => {
          if (mounted) {
            setReconnecting(true);
          }
        });

        socketRef.current.on("disconnect", () => {
          if (mounted) {
            setReconnecting(true);
          }
        });

        socketRef.current.on("connect_error", () => {
          if (mounted) {
            setReconnecting(true);
            setError(t("connection.lost"));
          }
        });

        socketRef.current.on("game:state", (nextGame: GameSummary) => {
          if (mounted) {
            setGame(nextGame);
            setError("");
          }
        });

        socketRef.current.on("game:removed", (payload: { gameId: string }) => {
          if (!mounted || payload?.gameId !== gameId) {
            return;
          }
          navigate("/dashboard", { replace: true });
        });

        socketRef.current.emit("game:join", { gameId }, (ack: GameEventAck) => {
          if (!mounted || ack.ok !== true) {
            if (mounted && ack.message) {
              setError(ack.message);
            }
            return;
          }

          if (ack.game) {
            setGame(ack.game);
          }
        });
      } catch (requestError: any) {
        if (mounted) {
          const statusCode = getApiStatusCode(requestError);
          setError(
            statusCode === 404
              ? t("errors.invalidLink")
              : getApiErrorMessage(requestError, t("errors.joinFailed")),
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    joinAndLoad();

    return () => {
      mounted = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
    // t intentionally omitted: this manages the socket lifecycle and must not
    // reconnect/rejoin the room just because the UI language changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, token, navigate]);

  function emitGameEvent(
    eventName: "game:move" | "game:resign" | "game:draw-offer" | "game:draw-response",
    payload: Record<string, unknown>,
  ) {
    return new Promise<void>((resolve, reject) => {
      if (!gameId || !socketRef.current) {
        reject(new Error(t("errors.sessionUnavailable")));
        return;
      }

      socketRef.current.emit(eventName, { gameId, ...payload }, (ack: GameEventAck) => {
        if (ack.ok === true) {
          resolve();
          return;
        }

        reject(new Error(ack.message || t("errors.moveActionFailed")));
      });
    });
  }

  async function handleMove(from: string, to: string, piece: string) {
    if (!game || acting || !canMove) {
      return false;
    }

    const promotion = piece.toLowerCase() === "wp" && to.endsWith("8")
      ? "q"
      : piece.toLowerCase() === "bp" && to.endsWith("1")
        ? "q"
        : undefined;

    // Apply the move locally the instant the piece is dropped — otherwise the board
    // would sit frozen for a full client→server→client round trip (socket emit, DB
    // write, broadcast back) before showing anything, which reads as "lag" even when
    // the server is healthy. The server is still authoritative: game:move below is
    // the real, validated move, and a rejection rolls this optimistic state back.
    const optimistic = new Chess();
    try {
      if (game.pgn) {
        optimistic.loadPgn(game.pgn);
      }
      optimistic.move({ from, to, promotion });
    } catch {
      return false; // illegal move — let the board snap the piece back, no round trip needed
    }

    const previousGame = game;
    setGame({
      ...game,
      fen: optimistic.fen(),
      pgn: optimistic.pgn(),
      turn: optimistic.turn(),
      isCheck: optimistic.isCheck(),
    });

    try {
      setActing(true);
      setMoveHint("");
      await emitGameEvent("game:move", {
        move: { from, to, promotion },
      });
      return true;
    } catch (moveError: any) {
      setGame(previousGame); // server rejected the move (e.g. a desync) — roll back
      setMoveHint(moveError.message || t("errors.moveRejected"));
      return false;
    } finally {
      setActing(false);
    }
  }

  async function handleAction(
    eventName: "game:resign" | "game:draw-offer" | "game:draw-response",
    payload: Record<string, unknown> = {},
  ) {
    if (acting) {
      return;
    }

    try {
      setActing(true);
      setError("");
      await emitGameEvent(eventName, payload);
    } catch (actionError: any) {
      setError(actionError.message || t("errors.actionFailed"));
    } finally {
      setActing(false);
    }
  }

  const statusText = (() => {
    if (!game) {
      return "";
    }

    if (game.result) {
      const resultLabel = formatResult(game.result, t);
      if (!game.terminalReason) {
        return resultLabel;
      }
      const reasonLabel = t(`reasons.${reasonTranslationKey(game.terminalReason)}`, {
        defaultValue: game.terminalReason,
      });
      return t("result.withReason", { result: resultLabel, reason: reasonLabel });
    }

    if (game.status === "waiting") {
      return t("turn.waitingForOpponent");
    }

    if (canMove) {
      return game.isCheck ? t("turn.yourMoveCheck") : t("turn.yourMove");
    }

    return game.isCheck ? t("turn.opponentMoveCheck") : t("turn.opponentMove");
  })();

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-50" aria-hidden>
        <div className="absolute left-0 top-0 h-[240px] w-[380px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-20 right-0 h-[200px] w-[340px] rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <Swords className="h-3.5 w-3.5 text-[#71808F]" aria-hidden />
            {t("header.badge")}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("header.title")}</h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {t("header.gameId", { id: gameId ?? "" })}
              </p>
            </div>
            {game ? (
              <Badge variant="outline" className="w-fit capitalize">
                {t(`status.${game.status}`, { defaultValue: game.status })}
              </Badge>
            ) : null}
          </div>
        </header>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t("loading.joining")}
          </div>
        ) : null}

        {reconnecting && !loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
            {t("connection.reconnecting")}
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        {game ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr] lg:items-start">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
                  <CardContent className="p-4 pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("clocks.white")}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      <LiveClock
                        side="w"
                        status={game.status}
                        result={game.result}
                        turn={game.turn}
                        serverNow={game.serverNow}
                        clockMs={game.clocks.whiteMs}
                      />
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {game.turn === "w" && game.status === "active" && !game.result ? (
                        <span className="text-primary">{t("clocks.running")}</span>
                      ) : (
                        "—"
                      )}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
                  <CardContent className="p-4 pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("clocks.black")}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      <LiveClock
                        side="b"
                        status={game.status}
                        result={game.result}
                        turn={game.turn}
                        serverNow={game.serverNow}
                        clockMs={game.clocks.blackMs}
                      />
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {game.turn === "b" && game.status === "active" && !game.result ? (
                        <span className="text-primary">{t("clocks.running")}</span>
                      ) : (
                        "—"
                      )}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4 text-primary" aria-hidden />
                    {t("players.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{t("players.white")}</span>
                    <span className="font-medium">
                      {game.players.white?.username ?? t("players.waitingPlaceholder")}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{t("players.black")}</span>
                    <span className="font-medium">
                      {game.players.black?.username ?? t("players.waitingPlaceholder")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 border-t border-border pt-3 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{game.timeControl}</span>
                  </div>
                  <p className="border-t border-border pt-3 text-sm leading-snug text-foreground">
                    {statusText}
                  </p>
                  {game.result ? (
                    <p className="text-sm text-muted-foreground">
                      {t("players.resultLabel")}{" "}
                      <span className="font-medium text-foreground">{formatResult(game.result, t)}</span>
                    </p>
                  ) : null}
                  {game.drawOfferBy ? (
                    <p className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                      {t("players.drawOfferPending", {
                        color: game.drawOfferBy === "w" ? t("players.white") : t("players.black"),
                      })}
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              {game.status === "waiting" ? (
                <Card className="border-primary/25 bg-card/80 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Share2 className="h-4 w-4 text-primary" aria-hidden />
                      {t("invite.title")}
                    </CardTitle>
                    <CardDescription>{t("invite.description")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{t("invite.linkLabel")}</p>
                      <div
                        className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5"
                        title={shareLink}
                      >
                        <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                          {shareLink}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        className="flex-1 gap-2"
                        onClick={() => void handleCopyInviteLink()}
                        aria-label={linkCopied ? t("invite.copiedAriaLabel") : t("invite.copyAriaLabel")}
                      >
                        {linkCopied ? (
                          <Check className="h-4 w-4" aria-hidden />
                        ) : (
                          <Copy className="h-4 w-4" aria-hidden />
                        )}
                        {linkCopied ? t("invite.copiedButton") : t("invite.copyButton")}
                      </Button>
                      {canNativeShare ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="shrink-0 px-3"
                          onClick={() => void handleShareInvite()}
                          aria-label={t("invite.shareButton")}
                        >
                          <Share2 className="h-4 w-4" aria-hidden />
                        </Button>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleCopyGameId()}
                      aria-label={idCopied ? t("invite.copiedAriaLabel") : t("invite.copyGameIdAriaLabel")}
                      className="flex w-full items-center justify-between gap-2 rounded-md border border-dashed border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      <span className="min-w-0 truncate">
                        {t("invite.gameIdLabel")}: <span className="font-mono text-foreground">{gameId}</span>
                      </span>
                      {idCopied ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                      ) : (
                        <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      )}
                    </button>

                    <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
                      {t("invite.waitingHint")}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <div className="space-y-4">
              <Card className="overflow-hidden border-border/80 bg-card/80 p-4 backdrop-blur-sm">
                <div className="board-shell mx-auto w-full max-w-[560px]">
                  <Chessboard
                    options={{
                      position: game.fen,
                      boardOrientation: localColor === "b" ? "black" : "white",
                      lightSquareStyle,
                      darkSquareStyle,
                      allowDragging: canMove && !acting,
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

              {moveHint ? (
                <div
                  role="alert"
                  className="rounded-lg border border-amber-500/45 bg-amber-950/45 px-4 py-3 text-sm shadow-sm"
                >
                  <p className="m-0 font-medium text-amber-200">{t("moveHint.title")}</p>
                  <p className="mt-2 m-0 leading-relaxed text-amber-100/95">{moveHint}</p>
                </div>
              ) : null}

              <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Timer className="h-4 w-4 text-muted-foreground" aria-hidden />
                    {t("actions.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="border border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
                    disabled={acting || game.status !== "active" || Boolean(game.result)}
                    onClick={() => handleAction("game:resign")}
                  >
                    {t("actions.resign")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={
                      acting ||
                      game.status !== "active" ||
                      Boolean(game.result) ||
                      Boolean(game.drawOfferBy)
                    }
                    onClick={() => handleAction("game:draw-offer")}
                  >
                    {t("actions.offerDraw")}
                  </Button>
                  {drawOfferForPlayer ? (
                    <>
                      <Button
                        type="button"
                        variant="accent"
                        disabled={acting}
                        onClick={() => handleAction("game:draw-response", { accept: true })}
                      >
                        {t("actions.acceptDraw")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={acting}
                        onClick={() => handleAction("game:draw-response", { accept: false })}
                      >
                        {t("actions.declineDraw")}
                      </Button>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </div>

      {gameEndModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-blue-900/30 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-end-title"
          aria-describedby="game-end-desc"
        >
          <Card className="w-full max-w-md border-border/80 bg-card shadow-2xl">
            <CardHeader className="space-y-3 text-center sm:text-left">
              <div className="flex justify-center text-5xl sm:justify-start" aria-hidden>
                {GAME_END_STICKERS[gameEndModal.kind]}
              </div>
              <CardTitle id="game-end-title" className="text-2xl">
                {gameEndModal.title}
              </CardTitle>
              <CardDescription
                id="game-end-desc"
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
