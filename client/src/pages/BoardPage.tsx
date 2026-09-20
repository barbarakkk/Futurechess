import { useState } from "react";
import { Chessboard, ChessboardProvider, SparePiece } from "react-chessboard";
import type { ChessboardOptions } from "react-chessboard";
import { Eraser, Grid2x2, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useBoardTheme } from "../hooks/useBoardTheme";
import { BOARD_NOTATION_OPTIONS } from "../lib/boardThemes";
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

export function BoardPage() {
  const { t } = useTranslation("board");
  const { lightSquareStyle, darkSquareStyle } = useBoardTheme();
  const [position, setPosition] = useState<Position>(createStartingPosition);
  const [selected, setSelected] = useState<string | null>(null);

  const options: ChessboardOptions = {
    position,
    lightSquareStyle,
    darkSquareStyle,
    ...BOARD_NOTATION_OPTIONS,
    allowDrawingArrows: false,
    showAnimations: false,
    onPieceClick: ({ isSparePiece, piece }) => {
      if (isSparePiece) {
        setSelected((current) => (current === piece.pieceType ? null : piece.pieceType));
      }
    },
    onSquareClick: ({ square }) => {
      if (selected) {
        setPosition((current) => ({ ...current, [square]: { pieceType: selected } }));
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

  const renderGroup = (types: string[]) => (
    <div className="flex gap-1.5">
      {types.map((type) => (
        <div key={type} className="board-dock-item w-11 sm:w-12">
          <div
            className={cn(
              "aspect-square rounded-xl border border-transparent p-1 transition-colors",
              selected === type && "border-primary bg-primary/10 ring-2 ring-primary/60",
            )}
          >
            <SparePiece pieceType={type} />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <section className="mx-auto w-full max-w-[760px] space-y-5">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
          <Grid2x2 className="h-6 w-6 text-primary" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </header>

      <ChessboardProvider options={options}>
        <Card className="overflow-hidden border-border/80 bg-card/80 p-3 shadow-lg backdrop-blur-sm sm:p-5">
          <div className="board-shell mx-auto w-full max-w-[680px]">
            <Chessboard />
          </div>
        </Card>
        <div className="board-dock mx-auto flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-[28px] border border-white/60 bg-white/70 px-3 py-2 shadow-[0_18px_36px_-20px_rgba(15,70,150,0.32)] backdrop-blur-xl">
          {renderGroup(WHITE_PIECES)}
          <span className="hidden h-8 w-px bg-border sm:block" aria-hidden />
          {renderGroup(BLACK_PIECES)}
          <span className="hidden h-8 w-px bg-border sm:block" aria-hidden />
          <Button type="button" variant="secondary" size="sm" onClick={clear}>
            <Eraser className="mr-2 h-4 w-4" aria-hidden />
            {t("clear")}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={resetPieces}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
            {t("reset")}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">{t("palette.hint")}</p>
      </ChessboardProvider>
    </section>
  );
}
