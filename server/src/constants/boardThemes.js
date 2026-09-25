const { resolvePieceSetId } = require("./pieceSets");

const DEFAULT_BOARD_THEME = "blue";

const BOARD_THEME_IDS = ["blue", "green", "wood", "purple", "grey", "red"];

function isBoardThemeId(value) {
  return typeof value === "string" && BOARD_THEME_IDS.includes(value);
}

function resolveBoardThemeId(value) {
  if (value === "classic") {
    return "red";
  }
  return isBoardThemeId(value) ? value : DEFAULT_BOARD_THEME;
}

function normalizePreferences(raw) {
  const prefs = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    boardTheme: resolveBoardThemeId(prefs.boardTheme),
    pieceSet: resolvePieceSetId(prefs.pieceSet),
  };
}

module.exports = {
  DEFAULT_BOARD_THEME,
  BOARD_THEME_IDS,
  isBoardThemeId,
  normalizePreferences,
};
