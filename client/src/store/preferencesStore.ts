import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_BOARD_THEME,
  resolveBoardThemeId,
  type BoardThemeId,
} from "../lib/boardThemes";
import {
  DEFAULT_PIECE_SET,
  resolvePieceSetId,
  type PieceSetId,
} from "../lib/pieceSets";

type PreferencesState = {
  boardTheme: BoardThemeId;
  pieceSet: PieceSetId;
  setBoardTheme: (theme: BoardThemeId) => void;
  setPieceSet: (pieceSet: PieceSetId) => void;
  hydrateFromServer: (prefs: { boardTheme?: unknown; pieceSet?: unknown }) => void;
  clearPreferences: () => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      boardTheme: DEFAULT_BOARD_THEME,
      pieceSet: DEFAULT_PIECE_SET,
      setBoardTheme: (boardTheme) => set({ boardTheme }),
      setPieceSet: (pieceSet) => set({ pieceSet }),
      hydrateFromServer: (prefs) => {
        set({
          boardTheme: resolveBoardThemeId(prefs.boardTheme),
          pieceSet: resolvePieceSetId(prefs.pieceSet),
        });
      },
      clearPreferences: () => set({ boardTheme: DEFAULT_BOARD_THEME, pieceSet: DEFAULT_PIECE_SET }),
    }),
    {
      name: "chesshub-preferences",
      merge: (persisted, current) => {
        const stored =
          persisted && typeof persisted === "object"
            ? (persisted as Partial<PreferencesState>)
            : {};
        return {
          ...current,
          ...stored,
          boardTheme: resolveBoardThemeId(stored.boardTheme),
          pieceSet: resolvePieceSetId(stored.pieceSet),
        };
      },
    },
  ),
);
