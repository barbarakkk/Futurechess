import { useState } from "react";
import { Languages, Palette, Settings, Shapes, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import {
  BOARD_THEME_IDS,
  BOARD_THEMES,
  type BoardThemeId,
} from "../lib/boardThemes";
import {
  getPieceSetPreviewPiece,
  PIECE_SET_IDS,
  type PieceSetId,
} from "../lib/pieceSets";
import { updateBoardTheme, updatePieceSet } from "../lib/preferencesApi";
import { cn } from "../lib/utils";
import { usePreferencesStore } from "../store/preferencesStore";

function ThemeSwatch({
  themeId,
  selected,
  label,
  onSelect,
}: {
  themeId: BoardThemeId;
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  const colors = BOARD_THEMES[themeId];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "inline-flex flex-col items-start gap-1.5 rounded-lg border p-1.5 text-left transition hover:-translate-y-0.5 hover:shadow-soft",
        selected ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/30",
      )}
    >
      <div className="grid h-9 w-9 grid-cols-2 overflow-hidden rounded border border-border/60">
        <div className="aspect-square" style={{ backgroundColor: colors.light }} />
        <div className="aspect-square" style={{ backgroundColor: colors.dark }} />
        <div className="aspect-square" style={{ backgroundColor: colors.dark }} />
        <div className="aspect-square" style={{ backgroundColor: colors.light }} />
      </div>
      <span className="text-[11px] font-medium text-foreground">{label}</span>
    </button>
  );
}

function PieceSetSwatch({
  pieceSetId,
  selected,
  label,
  onSelect,
}: {
  pieceSetId: PieceSetId;
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  const PreviewPiece = getPieceSetPreviewPiece(pieceSetId);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "inline-flex flex-col items-center gap-1.5 rounded-lg border p-1.5 text-left transition hover:-translate-y-0.5 hover:shadow-soft",
        selected ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/30",
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded border border-border/60 bg-secondary/40 p-1">
        <PreviewPiece />
      </div>
      <span className="text-[11px] font-medium text-foreground">{label}</span>
    </button>
  );
}

export function SettingsPage() {
  const { t } = useTranslation("settings");
  const boardTheme = usePreferencesStore((state) => state.boardTheme);
  const setBoardTheme = usePreferencesStore((state) => state.setBoardTheme);
  const pieceSet = usePreferencesStore((state) => state.pieceSet);
  const setPieceSet = usePreferencesStore((state) => state.setPieceSet);
  const hydrateFromServer = usePreferencesStore((state) => state.hydrateFromServer);
  const [saveError, setSaveError] = useState("");
  const [savingTheme, setSavingTheme] = useState<BoardThemeId | null>(null);
  const [pieceSetError, setPieceSetError] = useState("");
  const [savingPieceSet, setSavingPieceSet] = useState<PieceSetId | null>(null);

  async function handleThemeSelect(nextTheme: BoardThemeId) {
    if (nextTheme === boardTheme || savingTheme) {
      return;
    }

    const previousTheme = boardTheme;
    setSaveError("");
    setSavingTheme(nextTheme);
    setBoardTheme(nextTheme);

    try {
      const preferences = await updateBoardTheme(nextTheme);
      hydrateFromServer(preferences);
    } catch {
      setBoardTheme(previousTheme);
      setSaveError(t("boardColor.saveError"));
    } finally {
      setSavingTheme(null);
    }
  }

  async function handlePieceSetSelect(nextPieceSet: PieceSetId) {
    if (nextPieceSet === pieceSet || savingPieceSet) {
      return;
    }

    const previousPieceSet = pieceSet;
    setPieceSetError("");
    setSavingPieceSet(nextPieceSet);
    setPieceSet(nextPieceSet);

    try {
      const preferences = await updatePieceSet(nextPieceSet);
      hydrateFromServer(preferences);
    } catch {
      setPieceSet(previousPieceSet);
      setPieceSetError(t("pieceSet.saveError"));
    } finally {
      setSavingPieceSet(null);
    }
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-40" aria-hidden>
        <div className="absolute right-0 top-32 h-[200px] w-[300px] rounded-full bg-accent/10 blur-3xl" />
      </div>

      <section className="space-y-6">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
            {t("badge")}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
              <Settings className="h-6 w-6 text-primary" aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("title")}</h1>
              <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
            </div>
          </div>
        </header>

        <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Languages className="h-4 w-4 text-primary" aria-hidden />
              {t("language.title")}
            </CardTitle>
            <CardDescription>{t("language.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageSwitcher className="max-w-xs" />
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Palette className="h-4 w-4 text-primary" aria-hidden />
              {t("boardColor.title")}
            </CardTitle>
            <CardDescription>{t("boardColor.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2.5">
              {BOARD_THEME_IDS.map((themeId) => (
                <ThemeSwatch
                  key={themeId}
                  themeId={themeId}
                  selected={boardTheme === themeId}
                  label={t(`boardColor.themes.${themeId}`)}
                  onSelect={() => handleThemeSelect(themeId)}
                />
              ))}
            </div>
            {saveError ? (
              <p className="text-sm text-red-600" role="alert">
                {saveError}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shapes className="h-4 w-4 text-primary" aria-hidden />
              {t("pieceSet.title")}
            </CardTitle>
            <CardDescription>{t("pieceSet.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2.5">
              {PIECE_SET_IDS.map((pieceSetId) => (
                <PieceSetSwatch
                  key={pieceSetId}
                  pieceSetId={pieceSetId}
                  selected={pieceSet === pieceSetId}
                  label={t(`pieceSet.sets.${pieceSetId}`)}
                  onSelect={() => handlePieceSetSelect(pieceSetId)}
                />
              ))}
            </div>
            {pieceSetError ? (
              <p className="text-sm text-red-600" role="alert">
                {pieceSetError}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
