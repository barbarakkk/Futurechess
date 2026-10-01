import { useState } from "react";
import { Check, Languages, Palette, Shapes } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "../components/ui/card";
import { supportedLanguages } from "../i18n";
import {
  BOARD_THEME_IDS,
  BOARD_THEMES,
  type BoardThemeId,
} from "../lib/boardThemes";
import {
  getPieceSetTrio,
  PIECE_SET_IDS,
  type PieceSetId,
} from "../lib/pieceSets";
import { updateBoardTheme, updatePieceSet } from "../lib/preferencesApi";
import { cn } from "../lib/utils";
import { usePreferencesStore } from "../store/preferencesStore";

type Section = "language" | "boardColor" | "pieceSet";

const SECTIONS = [
  { id: "language", icon: Languages },
  { id: "boardColor", icon: Palette },
  { id: "pieceSet", icon: Shapes },
] as const;

const PRESS =
  "transition-[transform,box-shadow,border-color] duration-150 ease-out active:scale-[0.97]";

const SELECTED_CLASS = "border-primary bg-primary/5 ring-2 ring-primary/25";

/** A small checkerboard in a theme's two colors. */
function MiniBoard({ themeId, className }: { themeId: BoardThemeId; className?: string }) {
  const colors = BOARD_THEMES[themeId];
  const cells = 4;

  return (
    <div
      className={cn("grid grid-cols-4 overflow-hidden rounded-md border border-border/60", className)}
      aria-hidden
    >
      {Array.from({ length: cells * cells }, (_, index) => {
        const light = (Math.floor(index / cells) + (index % cells)) % 2 === 0;
        return <div key={index} style={{ backgroundColor: light ? colors.light : colors.dark }} />;
      })}
    </div>
  );
}

/** King, queen and both knights of a piece set. */
function PieceSetPreview({ pieceSetId }: { pieceSetId: PieceSetId }) {
  return (
    <div className="grid grid-cols-2" aria-hidden>
      {getPieceSetTrio(pieceSetId).map((Piece, index) => (
        <div key={index} className="aspect-square min-w-0">
          <Piece />
        </div>
      ))}
    </div>
  );
}

export function SettingsPage() {
  const { t, i18n } = useTranslation("settings");
  const currentLanguage = i18n.resolvedLanguage ?? i18n.language;
  const boardTheme = usePreferencesStore((state) => state.boardTheme);
  const setBoardTheme = usePreferencesStore((state) => state.setBoardTheme);
  const pieceSet = usePreferencesStore((state) => state.pieceSet);
  const setPieceSet = usePreferencesStore((state) => state.setPieceSet);
  const hydrateFromServer = usePreferencesStore((state) => state.hydrateFromServer);
  const [section, setSection] = useState<Section>("boardColor");
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
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
        <nav className="flex gap-1 md:flex-col" aria-label={t("title")}>
          {SECTIONS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              aria-current={section === id ? "page" : undefined}
              className={cn(
                PRESS,
                "flex flex-1 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium md:flex-none",
                section === id
                  ? "bg-card text-primary shadow-soft"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {t(`${id}.title`)}
            </button>
          ))}
        </nav>

        <Card key={section} className="panel-enter border-border/80 bg-card/90 p-6 shadow-soft">
          <h2 className="text-xl font-semibold tracking-tight">{t(`${section}.title`)}</h2>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">{t(`${section}.description`)}</p>

          {section === "language" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {supportedLanguages.map((language) => {
                const selected = currentLanguage === language.code;
                return (
                  <button
                    key={language.code}
                    type="button"
                    onClick={() => i18n.changeLanguage(language.code)}
                    aria-pressed={selected}
                    className={cn(
                      PRESS,
                      "flex items-center justify-between rounded-xl border p-4 text-left text-base font-semibold",
                      selected ? SELECTED_CLASS : "border-border hover:border-primary/30",
                    )}
                  >
                    {language.label}
                    {selected ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {section === "boardColor" ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {BOARD_THEME_IDS.map((themeId) => (
                  <button
                    key={themeId}
                    type="button"
                    onClick={() => handleThemeSelect(themeId)}
                    aria-pressed={boardTheme === themeId}
                    className={cn(
                      PRESS,
                      "space-y-2.5 rounded-xl border p-3 text-left",
                      boardTheme === themeId ? SELECTED_CLASS : "border-border hover:border-primary/30",
                    )}
                  >
                    <MiniBoard themeId={themeId} className="aspect-square w-full" />
                    <span className="block text-sm font-medium">{t(`boardColor.themes.${themeId}`)}</span>
                  </button>
                ))}
              </div>
              {saveError ? (
                <p className="mt-3 text-sm text-red-600" role="alert">
                  {saveError}
                </p>
              ) : null}
            </>
          ) : null}

          {section === "pieceSet" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {PIECE_SET_IDS.map((pieceSetId) => (
                  <button
                    key={pieceSetId}
                    type="button"
                    onClick={() => handlePieceSetSelect(pieceSetId)}
                    aria-pressed={pieceSet === pieceSetId}
                    className={cn(
                      PRESS,
                      "space-y-3 rounded-xl border p-3 text-left",
                      pieceSet === pieceSetId ? SELECTED_CLASS : "border-border hover:border-primary/30",
                    )}
                  >
                    <div className="rounded-lg bg-secondary/50 p-2">
                      <PieceSetPreview pieceSetId={pieceSetId} />
                    </div>
                    <span className="block text-sm font-medium">{t(`pieceSet.sets.${pieceSetId}`)}</span>
                  </button>
                ))}
              </div>
              {pieceSetError ? (
                <p className="mt-3 text-sm text-red-600" role="alert">
                  {pieceSetError}
                </p>
              ) : null}
            </>
          ) : null}
        </Card>
      </div>
    </section>
  );
}
