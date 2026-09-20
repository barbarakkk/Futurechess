import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { PIECE_GLYPHS } from "../../lib/chessCaptures";

// Name / side / captured pieces row shown above and below the board on both game pages.
export function PlayerStrip({
  name,
  subtitle,
  isYou,
  isTurn,
  waiting,
  thinking,
  thinkingLabel,
  captured,
  lead,
  clock,
}: {
  name: string;
  subtitle: string;
  isYou: boolean;
  isTurn: boolean;
  /** Opponent seat is still empty — shows a spinner instead of an initial. */
  waiting?: boolean;
  thinking?: boolean;
  thinkingLabel?: string;
  captured: string[];
  lead: number;
  clock?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-1">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
          isYou ? "bg-foreground text-background" : "bg-secondary text-accent"
        } ${isTurn ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
        aria-hidden
      >
        {waiting ? <Loader2 className="h-4 w-4 animate-spin" /> : name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate text-sm font-semibold leading-tight">
          {name}
          {thinking ? (
            <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              {thinkingLabel}
            </span>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2 text-lg leading-none" aria-hidden>
          <span className="tracking-[-0.15em] text-foreground/75">
            {captured.map((type, index) => (
              <span key={`${type}-${index}`}>{PIECE_GLYPHS[type]}</span>
            ))}
          </span>
          {lead > 0 ? <span className="font-mono text-xs font-bold text-muted-foreground">+{lead}</span> : null}
        </div>
        {clock}
      </div>
    </div>
  );
}
