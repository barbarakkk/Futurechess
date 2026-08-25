import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_BOARD_THEME,
  resolveBoardThemeId,
  type BoardThemeId,
} from "../lib/boardThemes";

type PreferencesState = {
  boardTheme: BoardThemeId;
  setBoardTheme: (theme: BoardThemeId) => void;
  hydrateFromServer: (prefs: { boardTheme?: unknown }) => void;
  clearPreferences: () => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      boardTheme: DEFAULT_BOARD_THEME,
      setBoardTheme: (boardTheme) => set({ boardTheme }),
      hydrateFromServer: (prefs) => {
        set({ boardTheme: resolveBoardThemeId(prefs.boardTheme) });
      },
      clearPreferences: () => set({ boardTheme: DEFAULT_BOARD_THEME }),
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
        };
      },
    },
  ),
);
