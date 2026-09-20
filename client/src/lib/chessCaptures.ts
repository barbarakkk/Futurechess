const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const STARTING_COUNTS: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };

export const PIECE_GLYPHS: Record<string, string> = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛" };

// Pieces each side has captured, plus material lead (positive = ahead), derived from the FEN.
export function getCaptureSummary(fen: string) {
  const remaining: Record<"w" | "b", Record<string, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };
  for (const char of fen.split(" ")[0]) {
    const type = char.toLowerCase();
    if (type in STARTING_COUNTS) {
      remaining[char === type ? "b" : "w"][type] += 1;
    }
  }
  const capturedBy = { w: [] as string[], b: [] as string[] };
  const material = { w: 0, b: 0 };
  for (const type of ["q", "r", "b", "n", "p"]) {
    for (let i = 0; i < STARTING_COUNTS[type] - remaining.b[type]; i += 1) capturedBy.w.push(type);
    for (let i = 0; i < STARTING_COUNTS[type] - remaining.w[type]; i += 1) capturedBy.b.push(type);
    material.w += remaining.w[type] * PIECE_VALUES[type];
    material.b += remaining.b[type] * PIECE_VALUES[type];
  }
  return { capturedBy, lead: { w: material.w - material.b, b: material.b - material.w } };
}
