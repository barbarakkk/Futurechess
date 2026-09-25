import { defaultPieces, type PieceRenderObject } from "react-chessboard";

// "classic" is react-chessboard's own built-in piece set (Colin M.L. Burnett's classic
// Staunton design) — nothing to bundle for it, see PIECE_RENDER_OBJECTS below.
//
// "merida" (Armando Hernandez Marroquin) and "shapes" (flugsio) are bundled from
// lichess.org's open-source piece art (github.com/lichess-org/lila, public/piece/),
// vendored as-is into assets/pieces/. Licenses: merida is GPLv2+, shapes is CC BY-SA 4.0.
export const PIECE_SET_IDS = ["classic", "merida", "shapes"] as const;

export type PieceSetId = (typeof PIECE_SET_IDS)[number];

export const DEFAULT_PIECE_SET: PieceSetId = "classic";

export function isPieceSetId(value: unknown): value is PieceSetId {
  return typeof value === "string" && (PIECE_SET_IDS as readonly string[]).includes(value);
}

export function resolvePieceSetId(value: unknown): PieceSetId {
  return isPieceSetId(value) ? value : DEFAULT_PIECE_SET;
}

const PIECE_CODES = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"] as const;

// Eagerly bundles every SVG under assets/pieces/<set>/<code>.svg as raw markup, keyed by its
// file path — adding another set later is just "drop 12 SVGs in a new folder + list its id
// above", no import list to maintain here.
const rawPieceSvgs = import.meta.glob<string>("../assets/pieces/*/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

// Each vendored SVG was exported independently and reuses trivial local ids for its own
// gradient/filter defs (typically `id="a"`) — harmless as a standalone file, but a board has
// up to 12 *different* piece SVGs injected into the same page at once (dangerouslySetInnerHTML
// below), and HTML ids are unique per document, not scoped to each inline <svg>. Without this,
// a later piece's `url(#a)` can silently resolve to an earlier, unrelated piece's gradient.
// This rewrites every `id="X"` in one SVG string (and every `#X` reference to it) to a name
// namespaced to that specific piece, so two different pieces can never collide.
function namespaceSvgIds(svg: string, namespace: string): string {
  const ids = new Set<string>();
  const idPattern = /\bid="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = idPattern.exec(svg))) {
    ids.add(match[1]);
  }

  let namespaced = svg;
  for (const id of ids) {
    const uniqueId = `${namespace}-${id}`;
    namespaced = namespaced
      .replaceAll(`id="${id}"`, `id="${uniqueId}"`)
      .replaceAll(`#${id}"`, `#${uniqueId}"`)
      .replaceAll(`#${id})`, `#${uniqueId})`);
  }
  return namespaced;
}

function buildPieceRenderObject(setId: string): PieceRenderObject | undefined {
  const renderObject: PieceRenderObject = {};

  for (const code of PIECE_CODES) {
    const rawSvg = rawPieceSvgs[`../assets/pieces/${setId}/${code}.svg`];
    if (!rawSvg) {
      // Incomplete set on disk — bail out entirely rather than rendering a half-broken board.
      return undefined;
    }
    const svg = namespaceSvgIds(rawSvg, `${setId}-${code}`);
    renderObject[code] = () => (
      // The fetched SVGs already bake in the correct per-piece fill color, so they're
      // rendered as-is; `.piece-figure svg` (style.css) stretches them to fill the square.
      <span className="piece-figure block h-full w-full" dangerouslySetInnerHTML={{ __html: svg }} />
    );
  }

  return renderObject;
}

// undefined for "classic" — omitting the Chessboard `pieces` option entirely lets the
// library use its own built-in set, so the default look for existing players never changes.
export const PIECE_RENDER_OBJECTS: Partial<Record<PieceSetId, PieceRenderObject>> = {
  merida: buildPieceRenderObject("merida"),
  shapes: buildPieceRenderObject("shapes"),
};

/** Chessboard `options.pieces` value for a given set id — undefined means "use the library default". */
export function getPieceRenderObject(setId: PieceSetId): PieceRenderObject | undefined {
  return PIECE_RENDER_OBJECTS[setId];
}

/** A single piece (white knight) from a given set, for a small settings-page preview swatch. */
export function getPieceSetPreviewPiece(setId: PieceSetId) {
  return (PIECE_RENDER_OBJECTS[setId] ?? defaultPieces).wN;
}
