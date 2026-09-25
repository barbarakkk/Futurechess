import { Chess, type Square } from "chess.js";
import type { CSSProperties } from "react";

export type MoveHintTarget = { square: string; isCapture: boolean };

// Legal destinations for the piece on `square`, as if it were that piece's own color's turn
// right now (turn forced, en passant cleared) — the same trick isPremoveLegal (lib/premove.ts)
// uses. When it actually is that color's turn this is just the real legal moves; when it isn't
// (dragging to queue a premove) it's the same "sensible gate" approximation premoves already
// rely on, so hints line up with what a premove drop will accept.
export function getPotentialMoveSquares(fen: string, square: string): MoveHintTarget[] {
  const piece = new Chess(fen).get(square as Square);

  if (!piece) {
    return [];
  }

  const fields = fen.split(" ");
  fields[1] = piece.color;
  fields[3] = "-";

  try {
    return new Chess(fields.join(" "))
      .moves({ square: square as Square, verbose: true })
      .map((move) => ({ square: move.to, isCapture: Boolean(move.captured) }));
  } catch {
    return [];
  }
}

// A small centered dot for a quiet move, a hollow ring for a capture — same visual language
// chess.com uses so a legal destination reads at a glance without a solid highlight fighting
// the square color or the piece underneath it.
const QUIET_HINT_STYLE: CSSProperties = {
  backgroundImage: "radial-gradient(circle, rgba(17, 24, 39, 0.22) 21%, transparent 22%)",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  pointerEvents: "none",
};

const CAPTURE_HINT_STYLE: CSSProperties = {
  backgroundImage:
    "radial-gradient(circle, transparent 0%, transparent 72%, rgba(17, 24, 39, 0.28) 74%, rgba(17, 24, 39, 0.28) 84%, transparent 86%)",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  pointerEvents: "none",
};

export function buildMoveHintSquareStyles(targets: MoveHintTarget[]): Record<string, CSSProperties> {
  const styles: Record<string, CSSProperties> = {};

  for (const target of targets) {
    styles[target.square] = target.isCapture ? CAPTURE_HINT_STYLE : QUIET_HINT_STYLE;
  }

  return styles;
}
