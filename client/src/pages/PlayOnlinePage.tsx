import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Radar, X } from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";

// Mirrors the server's QUEUE_TIMEOUT_MS (server/src/realtime/matchmakingQueue.js) — the
// server enforces the real cutoff, this is only for the client's visible countdown.
const SEARCH_TIMEOUT_MS = 60_000;

function formatElapsed(ms: number) {
  const clampedSeconds = Math.floor(Math.max(0, Math.min(SEARCH_TIMEOUT_MS, ms)) / 1000);
  const minutes = Math.floor(clampedSeconds / 60);
  const seconds = clampedSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

type MatchmakingAck = { ok: boolean; message?: string };
type SearchState = "connecting" | "searching" | "timeout" | "error";

export function PlayOnlinePage() {
  const { t } = useTranslation("playOnline");
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const socketRef = useRef<Socket | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const [state, setState] = useState<SearchState>("connecting");
  const [errorMessage, setErrorMessage] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);

  // Tears down the current socket. Emits `matchmaking:cancel` first so the server drops
  // the queue entry immediately rather than waiting on the transport-level disconnect —
  // covers the Cancel button, unmount (page leave / route change / logout), and a fresh
  // search superseding a previous one.
  function teardownSocket() {
    const socket = socketRef.current;
    socketRef.current = null;
    if (!socket) {
      return;
    }
    if (socket.connected) {
      socket.emit("matchmaking:cancel");
    }
    socket.removeAllListeners();
    socket.disconnect();
  }

  function startSearch() {
    if (!token) {
      return;
    }

    teardownSocket();
    startedAtRef.current = null;
    setElapsedMs(0);
    setErrorMessage("");
    setState("connecting");

    // No auto-reconnect: a dropped connection ends the search cleanly (the server already
    // removed the queue entry on disconnect) instead of silently re-queuing behind the scenes.
    const socket = io(api.defaults.baseURL as string, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("matchmaking:join", null, (ack: MatchmakingAck) => {
        // The page may have moved on (cancelled / unmounted / retried) before this ack arrived.
        if (socketRef.current !== socket) {
          return;
        }
        if (!ack?.ok) {
          setErrorMessage(ack?.message || t("errors.joinFailed"));
          setState("error");
          teardownSocket();
          return;
        }
        startedAtRef.current = Date.now();
        setState("searching");
      });
    });

    socket.on("matchmaking:matched", ({ gameId }: { gameId: string }) => {
      if (socketRef.current !== socket) {
        return;
      }
      // Matched — hand off to the same realtime game page friend games use. Clear the ref
      // first so teardownSocket() on unmount doesn't emit a pointless cancel afterwards.
      socketRef.current = null;
      socket.removeAllListeners();
      socket.disconnect();
      navigate(`/game/${gameId}`, { replace: true });
    });

    socket.on("matchmaking:timeout", () => {
      if (socketRef.current !== socket) {
        return;
      }
      setState("timeout");
      teardownSocket();
    });

    socket.on("connect_error", () => {
      if (socketRef.current !== socket) {
        return;
      }
      setErrorMessage(t("errors.connectionFailed"));
      setState("error");
      teardownSocket();
    });
  }

  useEffect(() => {
    startSearch();
    return () => {
      teardownSocket();
    };
    // Intentionally only keyed on `token` — `startSearch` itself is called directly for
    // retries (see the "Try again" button below) and shouldn't also re-trigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (state !== "searching") {
      return;
    }
    const interval = window.setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsedMs(Date.now() - startedAtRef.current);
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [state]);

  function handleCancel() {
    teardownSocket();
    navigate("/dashboard");
  }

  const searching = state === "connecting" || state === "searching";

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-60" aria-hidden>
        <div className="absolute -left-16 top-0 h-[260px] w-[400px] rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute bottom-10 right-0 h-[220px] w-[320px] rounded-full bg-accent/10 blur-3xl" />
      </div>

      <section className="mx-auto flex max-w-md flex-col items-center">
        <Card className="w-full border-border/80 bg-card/80 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center gap-5 py-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Radar
                className={`h-8 w-8 text-primary ${searching ? "animate-spin [animation-duration:2.5s]" : ""}`}
                aria-hidden
              />
            </span>

            {searching ? (
              <>
                <div className="space-y-1.5">
                  <h1 className="text-xl font-semibold tracking-tight">{t("searching.title")}</h1>
                  <p className="text-sm text-muted-foreground">{t("searching.subtitle")}</p>
                </div>
                <p className="font-mono text-4xl font-bold tabular-nums">{formatElapsed(elapsedMs)}</p>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <X className="mr-1.5 h-4 w-4" aria-hidden />
                  {t("cancel")}
                </Button>
              </>
            ) : null}

            {state === "timeout" ? (
              <>
                <div className="space-y-1.5">
                  <h1 className="text-xl font-semibold tracking-tight">{t("timeout.title")}</h1>
                  <p className="text-sm text-muted-foreground">{t("timeout.subtitle")}</p>
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => navigate("/dashboard")}>
                    {t("backToDashboard")}
                  </Button>
                  <Button type="button" onClick={startSearch}>
                    {t("tryAgain")}
                  </Button>
                </div>
              </>
            ) : null}

            {state === "error" ? (
              <>
                <div className="space-y-1.5">
                  <h1 className="text-xl font-semibold tracking-tight">{t("error.title")}</h1>
                  <p className="text-sm text-red-600" role="alert">
                    {errorMessage}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => navigate("/dashboard")}>
                    {t("backToDashboard")}
                  </Button>
                  <Button type="button" onClick={startSearch}>
                    {t("tryAgain")}
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
