import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Clock, Sparkles, Swords } from "lucide-react";
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

type TimeControl = "Bullet" | "Blitz" | "Rapid" | "Classical" | "Freestyle";

const controls: Array<{
  key: TimeControl;
  label: string;
  subtitleKey: string;
  badge: string;
}> = [
  { key: "Bullet", label: "Bullet", subtitleKey: "timeControl.bullet", badge: "1+0" },
  { key: "Blitz", label: "Blitz", subtitleKey: "timeControl.blitz", badge: "3+2" },
  { key: "Rapid", label: "Rapid", subtitleKey: "timeControl.rapid", badge: "10+0" },
  { key: "Classical", label: "Classical", subtitleKey: "timeControl.classical", badge: "30+0" },
  { key: "Freestyle", label: "Freestyle", subtitleKey: "timeControl.freestyle", badge: "∞" },
];

export function NewGamePage() {
  const { t } = useTranslation("newGame");
  const navigate = useNavigate();
  // NOTE: timeControl holds the literal English value ("Bullet" | "Blitz" | "Rapid" | "Classical" | "Freestyle")
  // sent verbatim to the API below — this must never be translated/localized.
  const [timeControl, setTimeControl] = useState<TimeControl>("Blitz");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleCreateGame() {
    setCreating(true);
    setError("");

    try {
      // `timeControl` is sent untouched — the server compares it against the literal
      // English strings "Bullet" | "Blitz" | "Rapid" | "Classical" | "Freestyle".
      const response = await api.post("/games", { timeControl });
      const gameId = response.data.game.id as string;
      navigate(`/game/${gameId}`);
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, t("defaultError")));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-60" aria-hidden>
        <div className="absolute -left-16 top-0 h-[260px] w-[400px] rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute bottom-10 right-0 h-[220px] w-[320px] rounded-full bg-accent/10 blur-3xl" />
      </div>

      <section className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            {t("badge")}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold tracking-tight md:text-4xl">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                  <Swords className="h-5 w-5 text-[#71808F]" aria-hidden />
                </span>
                {t("title")}
              </h1>
              <p className="text-muted-foreground">{t("description")}</p>
            </div>
          </div>
        </header>

        <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" aria-hidden />
              {t("timeControl.title")}
            </CardTitle>
            <CardDescription>{t("timeControl.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              {controls.map((control) => {
                const selected = timeControl === control.key;
                return (
                  <button
                    key={control.key}
                    type="button"
                    onClick={() => setTimeControl(control.key)}
                    className={`flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition ${
                      selected
                        ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(211_100%_50%_/_0.35)]"
                        : "border-border bg-background/50 hover:border-border hover:bg-secondary/60"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{control.label}</p>
                      <p className="text-sm text-muted-foreground">{t(control.subtitleKey)}</p>
                    </div>
                    <Badge variant={selected ? "default" : "outline"} className="shrink-0 tabular-nums">
                      {control.badge}
                    </Badge>
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
          className="w-full sm:w-auto sm:min-w-[200px]"
          disabled={creating}
          onClick={handleCreateGame}
        >
          {creating ? t("creatingGame") : t("createGame")}
        </Button>
      </section>
    </div>
  );
}
