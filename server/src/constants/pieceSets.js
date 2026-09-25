const DEFAULT_PIECE_SET = "classic";

// "classic" is react-chessboard's own built-in set (no client asset needed for it).
// "merida" and "shapes" are bundled SVGs in client/src/assets/pieces/ — see
// client/src/lib/pieceSets.ts for the licensing/attribution note for both.
const PIECE_SET_IDS = ["classic", "merida", "shapes"];

function isPieceSetId(value) {
  return typeof value === "string" && PIECE_SET_IDS.includes(value);
}

function resolvePieceSetId(value) {
  return isPieceSetId(value) ? value : DEFAULT_PIECE_SET;
}

module.exports = {
  DEFAULT_PIECE_SET,
  PIECE_SET_IDS,
  isPieceSetId,
  resolvePieceSetId,
};
