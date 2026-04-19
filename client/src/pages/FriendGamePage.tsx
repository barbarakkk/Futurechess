import { useEffect, useMemo, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  Equal,
  Loader2,
  Share2,
  Swords,
  Timer,
  Trophy,
  Users,
  WifiOff,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
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
import { Input } from "../components/ui/input";
import { api } from "../lib/api";
import { getApiErrorMessage, getApiStatusCode } from "../lib/errors";
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

function buildGameEndModalCopy(
  localColor: "w" | "b",
  g: GameSummary,
): { title: string; body: string; kind: "win" | "loss" | "draw" } {
  const { result, terminalReason, players } = g;
  if (!result) {
    return { title: "Game over", body: "", kind: "draw" };
  }

  const opponentLabel =
    (localColor === "w" ? players.black?.username : players.white?.username) ??
    "Your opponent";

  if (result === "1/2-1/2") {
    if (terminalReason === "draw-agreement") {
      return {
        title: "Draw",
        body: "You agreed to a draw. The game is over.",
        kind: "draw",
      };
    }
    if (terminalReason === "draw") {
      return {
        title: "Draw",
        body: "The game ended in a draw (stalemate, repetition, or other draw rule).",
        kind: "draw",
      };
    }
    return {
      title: "Draw",
      body: "The game ended in a draw.",
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
          title: "You won",
          body: `${opponentLabel} resigned.`,
          kind: "win",
        };
      case "checkmate":
        return {
          title: "You won",
          body: "Checkmate — well played.",
          kind: "win",
        };
      case "timeout":
        return {
          title: "You won",
          body: `${opponentLabel} ran out of time.`,
          kind: "win",
        };
      default:
        return {
          title: "You won",
          body: "The game is over in your favor.",
          kind: "win",
        };
    }
  }

  switch (terminalReason) {
    case "resign":
      return {
        title: "You resigned",
        body: `${opponentLabel} wins the game.`,
        kind: "loss",
      };
    case "checkmate":
      return {
        title: "You lost",
        body: "Checkmate.",
        kind: "loss",
      };
    case "timeout":
      return {
        title: "You lost",
        body: "You ran out of time.",
        kind: "loss",
      };
    default:
      return {
        title: "Game over",
        body: "You lost.",
        kind: "loss",
      };
  }
}

export function FriendGamePage() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [game, setGame] = useState<GameSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [reconnecting, setReconnecting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [moveHint, setMoveHint] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => window.clearInterval(interval);
  }, []);

  const liveClocks = useMemo(() => {
    if (!game) {
      return { whiteMs: 0, blackMs: 0 };
    }

    if (game.status !== "active" || game.result) {
      return game.clocks;
    }

    const serverNowMs = new Date(game.serverNow).getTime();
    const elapsed = Math.max(0, now - serverNowMs);

    if (game.turn === "w") {
      return {
        whiteMs: Math.max(0, game.clocks.whiteMs - elapsed),
        blackMs: game.clocks.blackMs,
      };
    }

    return {
      whiteMs: game.clocks.whiteMs,
      blackMs: Math.max(0, game.clocks.blackMs - elapsed),
    };
  }, [game, now]);

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
      setError("Could not copy to clipboard. Select the link and copy manually.");
    }
  }

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current) {
        clearTimeout(copyFeedbackTimerRef.current);
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
    setGameEndModal(buildGameEndModalCopy(localColor, game));
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
            setError("Realtime connection lost. Attempting to reconnect...");
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
              ? "This game link is invalid or expired."
              : getApiErrorMessage(
                  requestError,
                  "Could not join this game. The link might be invalid or full.",
                ),
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
  }, [gameId, token, navigate]);

  function emitGameEvent(
    eventName: "game:move" | "game:resign" | "game:draw-offer" | "game:draw-response",
    payload: Record<string, unknown>,
  ) {
    return new Promise<void>((resolve, reject) => {
      if (!gameId || !socketRef.current) {
        reject(new Error("Game session is unavailable"));
        return;
      }

      socketRef.current.emit(eventName, { gameId, ...payload }, (ack: GameEventAck) => {
        if (ack.ok === true) {
          resolve();
          return;
        }

        reject(new Error(ack.message || "Game action failed"));
      });
    });
  }

  async function handleMove(from: string, to: string, piece: string) {
    if (acting || !canMove) {
      return false;
    }

    const promotion = piece.toLowerCase() === "wp" && to.endsWith("8")
      ? "q"
      : piece.toLowerCase() === "bp" && to.endsWith("1")
        ? "q"
        : undefined;

    try {
      setActing(true);
      setMoveHint("");
      await emitGameEvent("game:move", {
        move: { from, to, promotion },
      });
      return true;
    } catch (moveError: any) {
      setMoveHint(moveError.message || "That move wasn't accepted.");
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
      setError(actionError.message || "Action failed");
    } finally {
      setActing(false);
    }
  }

  const statusText = (() => {
    if (!game) {
      return "";
    }

    if (game.result) {
      return `${formatResult(game.result)}${game.terminalReason ? ` by ${game.terminalReason}` : ""}`;
    }

    if (game.status === "waiting") {
      return "Waiting for an opponent to join.";
    }

    if (canMove) {
      return game.isCheck ? "Your move. You are in check." : "Your move.";
    }

    return game.isCheck ? "Opponent to move. They are in check." : "Opponent to move.";
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
            <Swords className="h-3.5 w-3.5 text-primary" aria-hidden />
            Friend match
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Friend game</h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">Game ID: {gameId}</p>
            </div>
            {game ? (
              <Badge variant="outline" className="w-fit capitalize">
                {game.status}
              </Badge>
            ) : null}
          </div>
        </header>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Joining game...
          </div>
        ) : null}

        {reconnecting && !loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
            Reconnecting to realtime game updates...
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-red-400" role="alert">
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
                      White
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {formatClock(liveClocks.whiteMs)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {game.turn === "w" && game.status === "active" && !game.result ? (
                        <span className="text-primary">Running</span>
                      ) : (
                        "—"
                      )}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
                  <CardContent className="p-4 pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Black
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {formatClock(liveClocks.blackMs)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {game.turn === "b" && game.status === "active" && !game.result ? (
                        <span className="text-primary">Running</span>
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
                    Players
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">White</span>
                    <span className="font-medium">
                      {game.players.white?.username ?? "Waiting..."}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Black</span>
                    <span className="font-medium">
                      {game.players.black?.username ?? "Waiting..."}
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
                      Result: <span className="font-medium text-foreground">{formatResult(game.result)}</span>
                    </p>
                  ) : null}
                  {game.drawOfferBy ? (
                    <p className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                      Draw offer pending from {game.drawOfferBy === "w" ? "White" : "Black"}.
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              {game.status === "waiting" ? (
                <Card className="border-primary/25 bg-card/80 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Share2 className="h-4 w-4 text-primary" aria-hidden />
                      Invite link
                    </CardTitle>
                    <CardDescription>Share this URL with your opponent.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={shareLink}
                        className="min-w-0 flex-1 font-mono text-xs"
                        aria-label="Game invite URL"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        className="shrink-0 px-3"
                        onClick={() => void handleCopyInviteLink()}
                        aria-label={linkCopied ? "Copied" : "Copy invite link"}
                      >
                        {linkCopied ? (
                          <Check className="h-4 w-4 text-accent" aria-hidden />
                        ) : (
                          <Copy className="h-4 w-4" aria-hidden />
                        )}
                      </Button>
                    </div>
                    {linkCopied ? (
                      <p className="mt-2 text-xs text-muted-foreground">Copied to clipboard.</p>
                    ) : null}
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
                  <p className="m-0 font-medium text-amber-200">Move not allowed</p>
                  <p className="mt-2 m-0 leading-relaxed text-amber-100/95">{moveHint}</p>
                </div>
              ) : null}

              <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Timer className="h-4 w-4 text-muted-foreground" aria-hidden />
                    Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="border border-red-500/30 bg-red-950/30 text-red-300 hover:bg-red-950/50"
                    disabled={acting || game.status !== "active" || Boolean(game.result)}
                    onClick={() => handleAction("game:resign")}
                  >
                    Resign
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
                    Offer draw
                  </Button>
                  {drawOfferForPlayer ? (
                    <>
                      <Button
                        type="button"
                        variant="accent"
                        disabled={acting}
                        onClick={() => handleAction("game:draw-response", { accept: true })}
                      >
                        Accept draw
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={acting}
                        onClick={() => handleAction("game:draw-response", { accept: false })}
                      >
                        Decline draw
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-end-title"
          aria-describedby="game-end-desc"
        >
          <Card className="w-full max-w-md border-border/80 bg-card shadow-2xl">
            <CardHeader className="space-y-3 text-center sm:text-left">
              <div className="flex justify-center sm:justify-start">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${
                    gameEndModal.kind === "win"
                      ? "bg-primary/15 text-primary"
                      : gameEndModal.kind === "draw"
                        ? "bg-secondary text-muted-foreground"
                        : "bg-red-950/50 text-red-300"
                  }`}
                >
                  {gameEndModal.kind === "win" ? (
                    <Trophy className="h-6 w-6" aria-hidden />
                  ) : gameEndModal.kind === "draw" ? (
                    <Equal className="h-6 w-6" aria-hidden />
                  ) : (
                    <AlertCircle className="h-6 w-6" aria-hidden />
                  )}
                </span>
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
                Returning to your dashboard in 5 seconds…
              </p>
              <Button
                type="button"
                className="w-full"
                onClick={() => navigate("/dashboard", { replace: true })}
              >
                Back to dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
