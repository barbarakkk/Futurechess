import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

export type AvailabilityException = { startMinute: number; endMinute: number };
// Key is a "YYYY-MM-DD" UTC calendar date.
export type ExceptionsMap = Record<string, AvailabilityException>;

export type AvailabilityStepValue = {
  exceptions: ExceptionsMap;
};

const DEFAULT_START_MINUTE = 10 * 60; // 10:00
const DEFAULT_END_MINUTE = 18 * 60; // 18:00

export function createDefaultAvailabilityValue(): AvailabilityStepValue {
  return { exceptions: {} };
}

function buildTimeOptions(): { minutes: number; label: string }[] {
  const options: { minutes: number; label: string }[] = [];
  for (let minutes = 6 * 60; minutes <= 22 * 60; minutes += 30) {
    const h = Math.floor(minutes / 60).toString().padStart(2, "0");
    const m = (minutes % 60).toString().padStart(2, "0");
    options.push({ minutes, label: `${h}:${m}` });
  }
  return options;
}

const TIME_OPTIONS = buildTimeOptions();
// A start time can't be the very last option (22:00), or there'd be no valid end-time left after it.
const START_TIME_OPTIONS = TIME_OPTIONS.slice(0, -1);

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type AvailabilityStepProps = {
  value: AvailabilityStepValue;
  onChange: (value: AvailabilityStepValue) => void;
};

/**
 * Step 5 of the become-a-coach wizard: a current-month calendar where each click adds or
 * removes a bookable date. This mirrors the same one-off-dates model CoachDashboardPage
 * already uses post-approval (PUT /coach/availability-exceptions) — there's no separate
 * recurring weekly pattern (see coach-selfservice.prd and coachAvailabilityService.js). All
 * dates/times here are UTC, so a browser's local timezone never causes an off-by-one
 * against what actually gets stored.
 */
export function CoachAvailabilityStep({ value, onChange }: AvailabilityStepProps) {
  const { t, i18n } = useTranslation("becomeCoach");
  const [promptDate, setPromptDate] = useState<string | null>(null);
  const [promptStart, setPromptStart] = useState(DEFAULT_START_MINUTE);
  const [promptEnd, setPromptEnd] = useState(DEFAULT_END_MINUTE);
  const [dateError, setDateError] = useState(false);

  const today = useMemo(() => utcToday(), []);
  const todayKey = useMemo(() => utcDateKey(today), [today]);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric", timeZone: "UTC" }).format(today),
    [i18n.language, today],
  );

  const weekdayHeaderLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(i18n.language, { weekday: "short", timeZone: "UTC" });
    // 2024-01-08T00:00:00Z is a Monday — stable reference to enumerate Monday-first weekday names.
    return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(Date.UTC(2024, 0, 8 + i))));
  }, [i18n.language]);

  const cells = useMemo(() => {
    const year = today.getUTCFullYear();
    const month = today.getUTCMonth();
    const firstOfMonth = new Date(Date.UTC(year, month, 1));
    // Convert getUTCDay() (0=Sun) to a Monday-first column offset (0=Mon..6=Sun).
    const firstWeekdayMondayFirst = (firstOfMonth.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const totalCells = Math.ceil((firstWeekdayMondayFirst + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, i) => {
      const date = new Date(Date.UTC(year, month, i - firstWeekdayMondayFirst + 1));
      return { date, key: utcDateKey(date), inMonth: date.getUTCMonth() === month };
    });
  }, [today]);

  function removeException(dateKey: string) {
    const next = { ...value.exceptions };
    delete next[dateKey];
    onChange({ ...value, exceptions: next });
  }

  // A coach applies today, so the earliest lesson slot they can offer is tomorrow — today
  // and every earlier date on this month's grid are shown but not selectable.
  function handleCellClick(cell: { key: string }) {
    if (cell.key <= todayKey) {
      setDateError(true);
      setPromptDate(null);
      return;
    }

    setDateError(false);
    if (value.exceptions[cell.key]) {
      removeException(cell.key);
      if (promptDate === cell.key) setPromptDate(null);
    } else {
      setPromptDate(cell.key);
      setPromptStart(DEFAULT_START_MINUTE);
      setPromptEnd(DEFAULT_END_MINUTE);
    }
  }

  function confirmAvailability() {
    if (!promptDate) return;
    onChange({
      ...value,
      exceptions: { ...value.exceptions, [promptDate]: { startMinute: promptStart, endMinute: promptEnd } },
    });
    setPromptDate(null);
  }

  const summary = useMemo(() => {
    const monthKeys = new Set(cells.filter((cell) => cell.inMonth).map((cell) => cell.key));
    let count = 0;
    for (const key of Object.keys(value.exceptions)) {
      if (monthKeys.has(key)) count += 1;
    }

    if (count === 0) {
      return t("form.wizard.availability.summaryEmpty");
    }
    return t("form.wizard.availability.daysAddedCount", { count });
  }, [value, cells, t]);

  const promptEndOptions = TIME_OPTIONS.filter((option) => option.minutes > promptStart);

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">{t("form.wizard.availability.utcNote")}</p>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{t("form.wizard.availability.calendarTitle")}</h3>
        <p className="text-xs text-muted-foreground">{t("form.wizard.availability.calendarSubtitle")}</p>

        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-center text-sm font-semibold capitalize">{monthLabel}</p>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdayHeaderLabels.map((label, i) => (
              <div key={i} className="text-xs font-medium uppercase text-muted-foreground">
                {label}
              </div>
            ))}
            {cells.map((cell) => {
              if (!cell.inMonth) {
                return <div key={cell.key} aria-hidden />;
              }
              const isAvailable = Boolean(value.exceptions[cell.key]);
              const isToday = cell.key === todayKey;
              const isTooSoon = cell.key <= todayKey;

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => handleCellClick(cell)}
                  aria-label={cell.date.toDateString()}
                  aria-disabled={isTooSoon}
                  className={cn(
                    "relative flex h-11 items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isTooSoon
                      ? "cursor-not-allowed text-muted-foreground/40"
                      : isAvailable
                        ? "bg-[#4CAF50]/15 text-[#2E7D32] hover:bg-[#4CAF50]/25"
                        : "text-foreground hover:bg-secondary",
                    isToday && "ring-1 ring-inset ring-ring",
                  )}
                >
                  {cell.date.getUTCDate()}
                </button>
              );
            })}
          </div>
        </div>

        {dateError ? (
          <p className="text-sm text-red-600" role="alert">
            {t("form.wizard.availability.pastDateError")}
          </p>
        ) : null}

        {promptDate ? (
          <div className="space-y-2 rounded-lg border border-border bg-card p-3">
            <p className="text-sm font-medium">
              {t("form.wizard.availability.oneOffPromptTitle", {
                date: new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeZone: "UTC" }).format(
                  new Date(`${promptDate}T00:00:00Z`),
                ),
              })}
            </p>
            <div className="flex items-center gap-2 text-sm">
              <select
                value={promptStart}
                onChange={(event) => {
                  const startMinute = Number(event.target.value);
                  setPromptStart(startMinute);
                  setPromptEnd((prevEnd) => (prevEnd > startMinute ? prevEnd : startMinute + 30));
                }}
                className={selectClass}
              >
                {START_TIME_OPTIONS.map((option) => (
                  <option key={option.minutes} value={option.minutes}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground">–</span>
              <select
                value={promptEnd}
                onChange={(event) => setPromptEnd(Number(event.target.value))}
                className={selectClass}
              >
                {promptEndOptions.map((option) => (
                  <option key={option.minutes} value={option.minutes}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={confirmAvailability}>
                {t("form.wizard.availability.oneOffAdd")}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setPromptDate(null)}>
                {t("form.wizard.availability.oneOffCancel")}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#4CAF50]" aria-hidden />
            {t("form.wizard.availability.legendAvailable")}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-secondary/50 p-3">
        <p className="text-sm text-foreground">{summary}</p>
      </div>
    </div>
  );
}
