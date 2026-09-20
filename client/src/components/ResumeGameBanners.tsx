import { useEffect, useState } from "react";
import { Cpu, Swords, X, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { api } from "../lib/api";
import { getApiErrorMessage } from "../lib/errors";
import { cn } from "../lib/utils";

type RecentGame = {
  id: string;
  status: string;
  timeControl: string;
  opponentUsername: string | null;
};

type ActiveAiGame = {
  id: string;
  difficulty: "easy" | "medium" | "hard";
  moveCount: number;
  isUserTurn: boolean;
};

// Shown wherever a player might end up after leaving a board mid-game (dashboard, play online,
// play vs AI) so an unfinished game is always one click away. Fetches on mount, so coming back to
// a page always reflects the latest state.
export function ResumeGameBanners({ className }: { className?: string }) {
  const { t } = useTranslation(["resume", "aiGame"]);
  const navigate = useNavigate();
  const [friendGame, setFriendGame] = useState<RecentGame | null>(null);
  const [aiGame, setAiGame] = useState<ActiveAiGame | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  async function cancelInvite(gameId: string) {
    try {
      setCancelling(true);
      setCancelError("");
      await api.post(`/games/${gameId}/cancel`);
      setFriendGame(null);
    } catch (requestError: any) {
      setCancelError(getApiErrorMessage(requestError, t("resume:cancelError")));
    } finally {
      setCancelling(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [recent, ai] = await Promise.allSettled([
        api.get("/games/recent"),
        api.get("/ai-games/active"),
      ]);
      if (!mounted) {
        return;
      }
      if (recent.status === "fulfilled") {
        const games: RecentGame[] = recent.value.data.games ?? [];
        setFriendGame(games.find((g) => g.status === "active" || g.status === "waiting") ?? null);
      }
      if (ai.status === "fulfilled") {
        setAiGame(ai.value.data.game ?? null);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const banners: {
    key: string;
    icon: typeof Zap;
    title: string;
    subtitle: string;
    cta: string;
    to: string;
    onCancel?: () => void;
  }[] = [];

  if (friendGame) {
    const waiting = friendGame.status === "waiting";
    banners.push({
      key: `friend-${friendGame.id}`,
      icon: Swords,
      title: waiting ? t("resume:friend.waitingTitle") : t("resume:friend.title"),
      subtitle: waiting
        ? t("resume:friend.waitingSubtitle", { timeControl: friendGame.timeControl })
        : t("resume:friend.subtitle", {
            timeControl: friendGame.timeControl,
            opponent: friendGame.opponentUsername ?? t("resume:friend.opponentFallback"),
          }),
      cta: waiting ? t("resume:ctaWaiting") : t("resume:cta"),
      to: `/game/${friendGame.id}`,
      onCancel: waiting ? () => void cancelInvite(friendGame.id) : undefined,
    });
  }

  if (aiGame) {
    banners.push({
      key: `ai-${aiGame.id}`,
      icon: Cpu,
      title: t("resume:ai.title"),
      subtitle: `${t("resume:ai.subtitle", {
        difficulty: t(`aiGame:setup.difficulty.${aiGame.difficulty}.label`),
        count: aiGame.moveCount,
      })} · ${aiGame.isUserTurn ? t("resume:ai.yourMove") : t("resume:ai.engineMove")}`,
      cta: t("resume:cta"),
      to: `/ai-game/${aiGame.id}`,
    });
  }

  if (banners.length === 0) {
    return null;
  }

  return (
    <div className={cn("grid gap-3", className)}>
      {banners.map(({ key, icon: Icon, title, subtitle, cta, to, onCancel }) => (
        <div
          key={key}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/[0.07] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_16px_32px_-20px_rgba(37,99,235,0.4)] backdrop-blur-xl"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <Icon className="h-5 w-5 text-primary" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-[-0.005em]">{title}</p>
              <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onCancel ? (
              <Button
                type="button"
                variant="danger"
                className="active:scale-[0.97]"
                disabled={cancelling}
                onClick={onCancel}
              >
                <X className="mr-1.5 h-4 w-4" aria-hidden />
                {t("resume:cancelInvite")}
              </Button>
            ) : null}
            <Button type="button" className="active:scale-[0.97]" onClick={() => navigate(to)}>
              {cta}
            </Button>
          </div>
        </div>
      ))}
      {cancelError ? (
        <p className="text-sm text-red-600" role="alert">
          {cancelError}
        </p>
      ) : null}
    </div>
  );
}
