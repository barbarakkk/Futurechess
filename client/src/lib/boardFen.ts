import { Chess } from "chess.js";

type Position = Record<string, { pieceType: string }>;

// Builds a FEN from the free-form Board page position. Castling rights are inferred from
// king/rook squares; en passant and move counters are left at defaults.
export function positionToFen(position: Position, turn: "w" | "b"): string {
  const rows: string[] = [];
  for (let rank = 8; rank >= 1; rank -= 1) {
    let row = "";
    let empty = 0;
    for (const file of "abcdefgh") {
      const piece = position[`${file}${rank}`]?.pieceType;
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty) {
        row += empty;
        empty = 0;
      }
      row += piece[0] === "w" ? piece[1].toUpperCase() : piece[1].toLowerCase();
    }
    rows.push(row + (empty || ""));
  }

  const at = (square: string) => position[square]?.pieceType;
  let castling = "";
  if (at("e1") === "wK") {
    if (at("h1") === "wR") castling += "K";
    if (at("a1") === "wR") castling += "Q";
  }
  if (at("e8") === "bK") {
    if (at("h8") === "bR") castling += "k";
    if (at("a8") === "bR") castling += "q";
  }

  return `${rows.join("/")} ${turn} ${castling || "-"} - 0 1`;
}

// Returns null when the position can be played from, otherwise a translation key suffix.
export function getPositionError(fen: string): "invalid" | "check" | "over" | null {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return "invalid";
  }

  const parts = fen.split(" ");
  parts[1] = parts[1] === "w" ? "b" : "w";
  parts[3] = "-";
  try {
    if (new Chess(parts.join(" ")).isCheck()) return "check";
  } catch {
    return "invalid";
  }

  if (chess.isGameOver()) return "over";
  return null;
}
