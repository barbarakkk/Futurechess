export const BOARD_THEME_IDS = ["blue", "green", "wood", "purple", "grey", "red"] as const;

export type BoardThemeId = (typeof BOARD_THEME_IDS)[number];

export const DEFAULT_BOARD_THEME: BoardThemeId = "blue";

export type BoardThemeColors = {
  light: string;
  dark: string;
};

export const BOARD_THEMES: Record<BoardThemeId, BoardThemeColors> = {
  blue: { light: "#ffffff", dark: "#b8dcff" },
  green: { light: "#ffffdd", dark: "#86a666" },
  wood: { light: "#f0d9b5", dark: "#b58863" },
  purple: { light: "#f3e8ff", dark: "#a78bfa" },
  grey: { light: "#f0f0f0", dark: "#b0b0b0" },
  red: { light: "#ffffff", dark: "#e57373" },
};

export function isBoardThemeId(value: unknown): value is BoardThemeId {
  return typeof value === "string" && BOARD_THEME_IDS.includes(value as BoardThemeId);
}

/** Maps legacy theme ids (e.g. "classic") to current ones. */
export function resolveBoardThemeId(value: unknown): BoardThemeId {
  if (value === "classic") {
    return "red";
  }
  return isBoardThemeId(value) ? value : DEFAULT_BOARD_THEME;
}

export function getBoardSquareStyles(themeId: BoardThemeId) {
  const colors = BOARD_THEMES[themeId] ?? BOARD_THEMES[DEFAULT_BOARD_THEME];
  return {
    lightSquareStyle: { backgroundColor: colors.light },
    darkSquareStyle: { backgroundColor: colors.dark },
  };
}
