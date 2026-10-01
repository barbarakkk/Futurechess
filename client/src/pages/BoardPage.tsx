import { useState } from "react";
import { Chessboard, ChessboardProvider, SparePiece } from "react-chessboard";
import type { ChessboardOptions } from "react-chessboard";
import { Bot, Eraser, Grid2x2, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BoardWithCoordinates } from "../components/game/BoardCoordinates";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useBoardTheme } from "../hooks/useBoardTheme";
import { BOARD_NOTATION_OPTIONS } from "../lib/boardThemes";
import { api } from "../lib/api";
import { getPositionError, positionToFen } from "../lib/boardFen";
import { getApiErrorMessage } from "../lib/errors";
import { cn } from "../lib/utils";

type Position = Record<string, { pieceType: string }>;

const WHITE_PIECES = ["wK", "wQ", "wR", "wB", "wN", "wP"];
const BLACK_PIECES = ["bK", "bQ", "bR", "bB", "bN", "bP"];

const BACK_RANK = ["R", "N", "B", "Q", "K", "B", "N", "R"];

// Standard chess starting position in react-chessboard's object format.
function createStartingPosition(): Position {
  const position: Position = {};
  "abcdefgh".split("").forEach((file, index) => {
    position[`${file}1`] = { pieceType: `w${BACK_RANK[index]}` };
    position[`${file}2`] = { pieceType: "wP" };
    position[`${file}7`] = { pieceType: "bP" };
    position[`${file}8`] = { pieceType: `b${BACK_RANK[index]}` };
  });
  return position;
}

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

export function BoardPage() {
  const { t } = useTranslation("board");
  const navigate = useNavigate();
  const [playAs, setPlayAs] = useState<"white" | "black">("white");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [starting, setStarting] = useState(false);
  const [playError, setPlayError] = useState("");
  const { lightSquareStyle, darkSquareStyle, pieces } = useBoardTheme();
  const [position, setPosition] = useState<Position>(createStartingPosition);
  const [selected, setSelected] = useState<string | null>(null);

  const options: ChessboardOptions = {
    position,
    lightSquareStyle,
    darkSquareStyle,
    pieces,
    ...BOARD_NOTATION_OPTIONS,
    allowDrawingArrows: false,
    showAnimations: false,
    onPieceClick: ({ isSparePiece, piece }) => {
      if (isSparePiece) {
        setSelected((current) =>
          current === piece.pieceType ? null : piece.pieceType,
        );
      }
    },
    onSquareClick: ({ square }) => {
      if (selected) {
        setPosition((current) => ({
          ...current,
          [square]: { pieceType: selected },
        }));
      }
    },
    onPieceDrop: ({ piece, sourceSquare, targetSquare }) => {
      setSelected(null);
      setPosition((current) => {
        const next = { ...current };
        if (!piece.isSparePiece) {
          delete next[sourceSquare];
        }
        if (targetSquare) {
          next[targetSquare] = { pieceType: piece.pieceType };
        }
        return next;
      });
      return true;
    },
  };

  const clear = () => {
    setPosition({});
    setSelected(null);
  };

  const resetPieces = () => {
    setPosition(createStartingPosition());
    setSelected(null);
  };

  const playFromPosition = async () => {
    const fen = positionToFen(position, playAs === "white" ? "w" : "b");
    const problem = getPositionError(fen);
    if (problem) {
      setPlayError(t(`play.errors.${problem}`));
      return;
    }

    try {
      setStarting(true);
      setPlayError("");
      const response = await api.post("/ai-games", {
        difficulty,
        userColor: playAs,
        fen,
      });
      navigate(`/ai-game/${response.data.game.id}`);
    } catch (requestError: any) {
      setPlayError(getApiErrorMessage(requestError, t("play.errors.generic")));
    } finally {
      setStarting(false);
    }
  };

  const renderGroup = (types: string[]) => (
    <div className="flex gap-1.5">
      {types.map((type) => (
        <div key={type} className="board-dock-item w-11 sm:w-12">
          <div
            className={cn(
              "aspect-square rounded-xl border border-transparent p-1 transition-colors",
              selected === type &&
                "border-primary bg-primary/10 ring-2 ring-primary/60",
            )}
          >
            <SparePiece pieceType={type} />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <section className="mx-auto w-full max-w-[1100px] space-y-5">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
          <Grid2x2 className="h-6 w-6 text-primary" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </header>

      <ChessboardProvider options={options}>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            <Card className="overflow-hidden border-border/80 bg-card/80 p-3 shadow-lg backdrop-blur-sm sm:p-5">
              <BoardWithCoordinates
                orientation="white"
                className="max-w-[680px]"
              >
                <Chessboard />
              </BoardWithCoordinates>
            </Card>
            <div className="board-dock mx-auto flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-[28px] border border-border/60 bg-card/70 px-3 py-2 shadow-[0_18px_36px_-20px_rgba(15,70,150,0.32)] backdrop-blur-xl">
              {renderGroup(WHITE_PIECES)}
              <span
                className="hidden h-8 w-px bg-border sm:block"
                aria-hidden
              />
              {renderGroup(BLACK_PIECES)}
              <span
                className="hidden h-8 w-px bg-border sm:block"
                aria-hidden
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={clear}
              >
                <Eraser className="mr-2 h-4 w-4" aria-hidden />
                {t("clear")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={resetPieces}
              >
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
                {t("reset")}
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {t("palette.hint")}
            </p>
          </div>

          <Card className="space-y-4 border-border/80 bg-card/80 p-4 sm:p-5 lg:sticky lg:top-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Bot className="h-5 w-5 text-primary" aria-hidden />
                {t("play.title")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("play.description")}
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{t("play.playAs")}</span>
                {(["white", "black"] as const).map((color) => (
                  <Button
                    key={color}
                    type="button"
                    size="sm"
                    variant={playAs === color ? "default" : "secondary"}
                    onClick={() => setPlayAs(color)}
                  >
                    {t(`palette.${color}`)}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {t("play.difficulty")}
                </span>
                {DIFFICULTIES.map((level) => (
                  <Button
                    key={level}
                    type="button"
                    size="sm"
                    variant={difficulty === level ? "default" : "secondary"}
                    onClick={() => setDifficulty(level)}
                  >
                    {t(`play.levels.${level}`)}
                  </Button>
                ))}
              </div>
            </div>
            {playError ? (
              <p className="text-sm text-destructive">{playError}</p>
            ) : null}
            <Button
              type="button"
              className="w-full"
              onClick={playFromPosition}
              disabled={starting}
            >
              <Bot className="mr-2 h-4 w-4" aria-hidden />
              {starting ? t("play.starting") : t("play.button")}
            </Button>
          </Card>
        </div>
      </ChessboardProvider>
    </section>
  );
}
