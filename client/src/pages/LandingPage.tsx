import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  ArrowRight,
  Cpu,
  Crown,
  LayoutDashboard,
  Sparkles,
  Swords,
} from "lucide-react";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { getBoardSquareStyles } from "../lib/boardThemes";

const LANDING_BOARD_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// The landing page is a public marketing page — its board preview always stays the
// light-blue "blue" theme, regardless of what a logged-in user picked in Settings.
const { lightSquareStyle, darkSquareStyle } = getBoardSquareStyles("blue");

// A real, verified brilliancy — Nona Gaprindashvili (White) vs Rudolf Servaty, Dortmund
// 1974: a queen sac into a forced mating net, Black resigned after 17.Qf6.
// https://www.chessgames.com/perl/chessgame?gid=1047235
const REPLAY_GAME_PGN =
  "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 g6 5. c4 Bg7 6. Be3 Nf6 7. Nc3 Ng4 8. Qxg4 Nxd4 9. Qd1 e5 10. Nb5 O-O 11. Be2 Qh4 12. Nxd4 exd4 13. Bxd4 Qxe4 14. Bxg7 Qxg2 15. Qd4 Qxh1+ 16. Kd2 Qxa1 17. Qf6";

type ReplayStep = { fen: string; toSquare: string };

// Precomputed once at module load: one entry per half-move (ply), holding the resulting
// FEN and the destination square to glow-highlight for that step.
const REPLAY_STEPS: ReplayStep[] = (() => {
  const source = new Chess();
  source.loadPgn(REPLAY_GAME_PGN);
  return source.history({ verbose: true }).map((move) => ({ fen: move.after, toSquare: move.to }));
})();

const REPLAY_TOTAL_DURATION_MS = 30_000;
const REPLAY_STEP_MS = REPLAY_TOTAL_DURATION_MS / REPLAY_STEPS.length;
const REPLAY_FINAL_PAUSE_MS = 400;
const REPLAY_OVERLAY_HOLD_MS = 8000;
const REPLAY_OVERLAY_FADE_MS = 500;

// Federations of the two real players in REPLAY_GAME_PGN — not translatable UI copy,
// just a fixed factual pairing for this one hardcoded historical game.
const REPLAY_WHITE_FLAG = "🇬🇪"; // Nona Gaprindashvili — Georgia
const REPLAY_BLACK_FLAG = "🇩🇪"; // Rudolf Servaty — Germany

type ReplayPhase = "idle" | "playing" | "overlay-in" | "overlay-out";

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function LandingPage() {
  const { t } = useTranslation("landing");

  // Clicking the decorative board triggers a one-shot animated replay of REPLAY_GAME_PGN;
  // runIdRef guards against overlapping runs and stale setState calls after unmount.
  const [replayPhase, setReplayPhase] = useState<ReplayPhase>("idle");
  const [replayStepIndex, setReplayStepIndex] = useState(0); // 0 = starting position
  const [highlightSquare, setHighlightSquare] = useState<string | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
    };
  }, []);

  async function playReplay() {
    if (replayPhase !== "idle") {
      return;
    }
    const runId = (runIdRef.current += 1);

    setReplayPhase("playing");

    for (let i = 0; i < REPLAY_STEPS.length; i += 1) {
      await delay(REPLAY_STEP_MS);
      if (runIdRef.current !== runId) return;
      setReplayStepIndex(i + 1);
      setHighlightSquare(REPLAY_STEPS[i].toSquare);
    }

    await delay(REPLAY_FINAL_PAUSE_MS);
    if (runIdRef.current !== runId) return;
    setReplayPhase("overlay-in");

    await delay(REPLAY_OVERLAY_HOLD_MS);
    if (runIdRef.current !== runId) return;
    setReplayPhase("overlay-out");

    await delay(REPLAY_OVERLAY_FADE_MS);
    if (runIdRef.current !== runId) return;
    setReplayPhase("idle");
    setReplayStepIndex(0);
    setHighlightSquare(null);
  }

  const replayFen = replayStepIndex === 0 ? LANDING_BOARD_FEN : REPLAY_STEPS[replayStepIndex - 1].fen;
  const showOverlay = replayPhase === "overlay-in" || replayPhase === "overlay-out";

  const squareStyles = useMemo(() => {
    if (!highlightSquare || replayPhase !== "playing") {
      return {};
    }
    return {
      [highlightSquare]: {
        boxShadow: "inset 0 0 0 9999px hsl(211 100% 50% / 0.22), 0 0 14px 4px hsl(211 100% 50% / 0.55)",
      },
    };
  }, [highlightSquare, replayPhase]);

  const landingBoardOptions = useMemo(
    () => ({
      position: replayFen,
      allowDragging: false,
      showNotation: false,
      showAnimations: replayPhase === "playing",
      animationDurationInMs: Math.min(400, REPLAY_STEP_MS * 0.6),
      squareStyles,
      onSquareClick: () => {
        void playReplay();
      },
      lightSquareStyle,
      darkSquareStyle,
      boardStyle: {
        borderRadius: "0.75rem",
        boxShadow:
          "0 0 0 3px hsl(211 100% 50% / 0.1), 0 12px 28px -8px hsl(211 100% 50% / 0.16)",
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [replayFen, replayPhase, squareStyles],
  );

  const features = [
    {
      icon: Swords,
      title: t("features.friendGames.title"),
      description: t("features.friendGames.description"),
      accentColor: "#2563EB",
      iconClass: "bg-[#2563EB]",
    },
    {
      icon: Cpu,
      title: t("features.playVsAi.title"),
      description: t("features.playVsAi.description"),
      accentColor: "#7C3AED",
      iconClass: "bg-[#7C3AED]",
    },
    {
      icon: LayoutDashboard,
      title: t("features.dashboard.title"),
      description: t("features.dashboard.description"),
      accentColor: "#10B981",
      iconClass: "bg-[#10B981]",
    },
  ] as const;

  return (
    <div className="landing-page relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="landing-page__blobs pointer-events-none absolute inset-0" aria-hidden />

      <header className="relative z-20 border-b border-border/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 md:px-8">
          <Link to="/" className="flex items-center gap-2.5 no-underline hover:no-underline">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Crown className="h-5 w-5 text-[#D4AF37]" aria-hidden />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              FutureChess
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher className="hidden py-1.5 sm:flex" />
            <Link
              to="/login"
              className="hidden px-3 py-2 text-sm font-medium text-muted-foreground no-underline transition hover:text-foreground sm:inline"
            >
              {t("signIn")}
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground no-underline transition hover:opacity-90"
            >
              {t("createAccount")}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative z-10 overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-2 md:gap-16 md:px-8 md:py-24 lg:py-28">
            <div className="max-w-xl">
              <div className="landing-fade-up inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white px-3.5 py-1.5 text-xs font-medium text-primary shadow-soft">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {t("badge")}
              </div>

              <h1 className="landing-fade-up landing-fade-up-delay-1 mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem]">
                {t("heroTitle")}
              </h1>

              <p className="landing-fade-up landing-fade-up-delay-2 mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t("heroSubtitle")}
              </p>

              <div className="landing-fade-up landing-fade-up-delay-3 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground no-underline shadow-soft transition hover:opacity-90"
                >
                  {t("getStarted")}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-white px-6 py-3.5 text-sm font-semibold text-foreground no-underline transition hover:bg-secondary"
                >
                  {t("haveAccount")}
                </Link>
              </div>
            </div>

            <div className="landing-fade-up landing-fade-up-delay-2 relative mx-auto w-full max-w-md md:max-w-none">
              <div className="landing-page__board-frame relative rounded-2xl border border-primary/15 p-5 shadow-soft md:p-6">
                <div className="landing-page__board w-full">
                  <Chessboard options={landingBoardOptions} />
                </div>

                <div className="absolute -right-3 -top-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-white shadow-soft">
                  <Crown className="h-6 w-6 text-[#D4AF37]" aria-hidden />
                </div>
                <div className="absolute -bottom-3 -left-3 rounded-2xl border border-border bg-white px-3 py-2 text-xs font-semibold text-primary shadow-soft">
                  FutureChess
                </div>
              </div>

              <div
                className="pointer-events-none absolute -right-8 top-1/2 hidden h-32 w-32 -translate-y-1/2 rounded-full bg-primary/15 blur-3xl md:block"
                aria-hidden
              />

              {showOverlay ? (
                <div
                  className={`landing-page__replay-popup ${
                    replayPhase === "overlay-in"
                      ? "landing-page__replay-popup--in"
                      : "landing-page__replay-popup--out"
                  }`}
                  role="status"
                >
                  <p className="landing-page__replay-popup-title">
                    <span aria-hidden>{REPLAY_WHITE_FLAG}</span> {t("replay.whitePlayer")}
                    {" — "}
                    <span aria-hidden>{REPLAY_BLACK_FLAG}</span> {t("replay.blackPlayer")}
                  </p>
                  <p className="landing-page__replay-popup-subtitle">{t("replay.result")}</p>
                  <p className="landing-page__replay-popup-quote">{t("replay.quote")}</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="relative z-10 border-t border-border/60 bg-[#F5F7FA]">
          <div className="mx-auto max-w-6xl px-6 py-16 md:px-8 md:py-20">
            <ul className="grid gap-6 md:grid-cols-3">
              {features.map((feature) => (
                <li
                  key={feature.title}
                  className="landing-feature-card group rounded-2xl border border-x-[#E2E8F0] border-b-[#E2E8F0] border-t-4 bg-[#FFFFFF] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft"
                  style={{ borderTopColor: feature.accentColor }}
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl text-white transition ${feature.iconClass}`}
                  >
                    <feature.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h2 className="mt-4 font-display text-lg font-semibold tracking-tight text-[#1E293B]">
                    {feature.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
                    {feature.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="relative z-10 border-t border-border/60">
          <div className="landing-page__cta-band mx-auto max-w-6xl px-6 py-14 md:px-8 md:py-16">
            <div className="flex flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
              <div>
                <p className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  {t("heroTitle")}
                </p>
                <p className="mt-2 max-w-lg text-sm text-muted-foreground sm:text-base">
                  {t("heroSubtitle")}
                </p>
              </div>
              <Link
                to="/register"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground no-underline shadow-soft transition hover:opacity-90"
              >
                {t("getStarted")}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/60 bg-white py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-muted-foreground sm:flex-row md:px-8">
          <span className="flex items-center gap-2 font-medium text-foreground">
            <Crown className="h-4 w-4 text-[#D4AF37]" aria-hidden />
            FutureChess
          </span>
          <Link to="/login" className="no-underline hover:text-primary">
            {t("signIn")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
