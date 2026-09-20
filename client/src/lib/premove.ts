import { Chess, type Square } from "chess.js";

export type Premove = { from: string; to: string };

// A premove is legal if it would be a legal move for `color` were it their turn right now
// (turn flipped to them, en passant cleared). It is re-validated against the real position
// when it fires, so this only has to be a sensible gate for queueing.
export function isPremoveLegal(fen: string, color: "w" | "b", from: string, to: string) {
  const fields = fen.split(" ");
  fields[1] = color;
  fields[3] = "-";
  try {
    return new Chess(fields.join(" "))
      .moves({ square: from as Square, verbose: true })
      .some((move) => move.to === to);
  } catch {
    return false;
  }
}

export const PREMOVE_SQUARE_STYLE = {
  background: "rgba(37, 99, 235, 0.5)",
  boxShadow: "inset 0 0 0 3px rgba(37, 99, 235, 0.9)",
};

export const PREMOVE_ARROW_COLOR = "rgba(37, 99, 235, 0.9)";
