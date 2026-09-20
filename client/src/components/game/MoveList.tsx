import { useEffect, useRef } from "react";

// Two-column SAN move list that keeps the latest move in view.
export function MoveList({
  sans,
  emptyLabel,
  maxHeight = "max-h-56",
}: {
  sans: string[];
  emptyLabel: string;
  maxHeight?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [sans.length]);

  const rows: { n: number; w: string; b: string }[] = [];
  sans.forEach((san, index) => {
    if (index % 2 === 0) {
      rows.push({ n: index / 2 + 1, w: san, b: "" });
    } else {
      rows[rows.length - 1].b = san;
    }
  });

  return (
    <div
      ref={ref}
      className={`grid ${maxHeight} grid-cols-[28px_1fr_1fr] content-start gap-x-2 gap-y-0.5 overflow-y-auto font-mono text-[13px]`}
    >
      {rows.length === 0 ? (
        <p className="col-span-3 font-sans text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        rows.map((row) => (
          <div key={row.n} className="contents">
            <span className="py-1 text-muted-foreground">{row.n}.</span>
            {[row.w, row.b].map((san, index) => (
              <span
                key={index}
                className={`rounded-md px-2 py-1 ${
                  (row.n - 1) * 2 + index === sans.length - 1 ? "bg-primary/10 font-bold text-primary" : ""
                }`}
              >
                {san}
              </span>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
