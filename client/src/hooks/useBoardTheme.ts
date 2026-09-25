import { getBoardSquareStyles } from "../lib/boardThemes";
import { getPieceRenderObject } from "../lib/pieceSets";
import { usePreferencesStore } from "../store/preferencesStore";

export function useBoardTheme() {
  const boardTheme = usePreferencesStore((state) => state.boardTheme);
  const pieceSet = usePreferencesStore((state) => state.pieceSet);
  const { lightSquareStyle, darkSquareStyle } = getBoardSquareStyles(boardTheme);
  // undefined for the "classic" set — omitted from Chessboard options so the library's own
  // built-in pieces render, same as before this preference existed.
  const pieces = getPieceRenderObject(pieceSet);

  return {
    boardTheme,
    lightSquareStyle,
    darkSquareStyle,
    pieceSet,
    pieces,
  };
}
