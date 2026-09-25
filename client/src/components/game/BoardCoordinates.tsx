import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

/**
 * Wraps a <Chessboard> with rank (1-8) and file (a-h) labels in the margin next to and
 * below the board, rather than the library's default of printing them faintly inside the
 * corner of each edge square — small and low-contrast against some board themes. Pass
 * `showNotation: false` in the Chessboard's own options so the two don't double up.
 */
export function BoardWithCoordinates({
  orientation,
  className,
  children,
}: {
  orientation: "white" | "black";
  className?: string;
  children: ReactNode;
}) {
  const ranks = orientation === "white" ? RANKS : [...RANKS].reverse();
  const files = orientation === "white" ? FILES : [...FILES].reverse();

  return (
    <div className={cn("mx-auto w-full", className)}>
      <div className="flex items-stretch gap-1.5">
        <div className="flex w-4 shrink-0 flex-col sm:w-5">
          {ranks.map((rank) => (
            <span
              key={rank}
              className="flex flex-1 items-center justify-center text-[11px] font-bold text-muted-foreground sm:text-xs"
            >
              {rank}
            </span>
          ))}
        </div>
        <div className="board-shell min-w-0 flex-1">{children}</div>
      </div>
      <div className="flex gap-1.5">
        <div className="w-4 shrink-0 sm:w-5" aria-hidden />
        <div className="flex min-w-0 flex-1">
          {files.map((file) => (
            <span
              key={file}
              className="flex-1 text-center text-[11px] font-bold text-muted-foreground sm:text-xs"
            >
              {file}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
