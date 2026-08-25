import { getBoardSquareStyles } from "../lib/boardThemes";
import { usePreferencesStore } from "../store/preferencesStore";

export function useBoardTheme() {
  const boardTheme = usePreferencesStore((state) => state.boardTheme);
  const { lightSquareStyle, darkSquareStyle } = getBoardSquareStyles(boardTheme);

  return {
    boardTheme,
    lightSquareStyle,
    darkSquareStyle,
  };
}
