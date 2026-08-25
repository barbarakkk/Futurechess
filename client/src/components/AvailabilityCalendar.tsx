import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

type Slot = {
  id: string;
  startTime: string;
  endTime: string;
};

type AvailabilityCalendarProps = {
  availability: Slot[];
  bookingSlotId: string | null;
  onBook: (slotId: string) => void;
};

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function AvailabilityCalendar({ availability, bookingSlotId, onBook }: AvailabilityCalendarProps) {
  const { t, i18n } = useTranslation("coaches");

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of availability) {
      const key = dateKey(new Date(slot.startTime));
      const existing = map.get(key);
      if (existing) {
        existing.push(slot);
      } else {
        map.set(key, [slot]);
      }
    }
    for (const slots of map.values()) {
      slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [availability]);

  const firstAvailable = useMemo(() => {
    return availability
      .map((slot) => new Date(slot.startTime))
      .sort((a, b) => a.getTime() - b.getTime())[0];
  }, [availability]);

  const [viewMonth, setViewMonth] = useState(() => startOfMonth(firstAvailable ?? new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(() =>
    firstAvailable ? dateKey(firstAvailable) : null,
  );

  useEffect(() => {
    setViewMonth(startOfMonth(firstAvailable ?? new Date()));
    setSelectedDay(firstAvailable ? dateKey(firstAvailable) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability.length]);

  const monthLabel = new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }).format(
    viewMonth,
  );

  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(i18n.language, { weekday: "short" });
    // 2024-01-07 is a Sunday — used purely as a stable reference to enumerate weekday names.
    return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(2024, 0, 7 + i)));
  }, [i18n.language]);

  const cells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, i) => {
      const date = new Date(year, month, i - firstWeekday + 1);
      return {
        date,
        key: dateKey(date),
        inMonth: date.getMonth() === month,
      };
    });
  }, [viewMonth]);

  const todayKey = dateKey(new Date());

  function goToPreviousMonth() {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  const selectedSlots = selectedDay ? (slotsByDay.get(selectedDay) ?? []) : [];
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { timeStyle: "short" }),
    [i18n.language],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={goToPreviousMonth} aria-label={t("detail.calendarPrevMonth")}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <p className="text-sm font-semibold capitalize">{monthLabel}</p>
        <Button type="button" variant="ghost" size="sm" onClick={goToNextMonth} aria-label={t("detail.calendarNextMonth")}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdayLabels.map((label) => (
          <div key={label} className="text-xs font-medium uppercase text-muted-foreground">
            {label}
          </div>
        ))}

        {cells.map(({ date, key, inMonth }) => {
          const hasSlots = slotsByDay.has(key);
          const isSelected = selectedDay === key;
          const isToday = key === todayKey;

          return (
            <button
              key={key}
              type="button"
              disabled={!hasSlots}
              onClick={() => setSelectedDay(key)}
              className={cn(
                "flex h-10 items-center justify-center rounded-md text-sm transition-colors",
                !inMonth && "text-muted-foreground/40",
                inMonth && !hasSlots && "text-muted-foreground/70",
                hasSlots && "bg-primary/15 font-semibold text-primary hover:bg-primary/25",
                hasSlots && isSelected && "bg-primary text-primary-foreground hover:bg-primary",
                !hasSlots && "cursor-default",
                isToday && !isSelected && "ring-1 ring-inset ring-ring",
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-2.5 w-2.5 rounded-full bg-primary/60" aria-hidden />
        {t("detail.calendarLegend")}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        {availability.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("detail.availabilityEmpty")}</p>
        ) : selectedDay === null ? (
          <p className="text-sm text-muted-foreground">{t("detail.calendarSelectPrompt")}</p>
        ) : selectedSlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("detail.calendarNoSlotsDay")}</p>
        ) : (
          <ul className="space-y-2">
            {selectedSlots.map((slot) => (
              <li
                key={slot.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-4 py-3"
              >
                <span className="text-sm font-medium">
                  {timeFormatter.format(new Date(slot.startTime))}–{timeFormatter.format(new Date(slot.endTime))}
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={bookingSlotId === slot.id}
                  onClick={() => onBook(slot.id)}
                >
                  {bookingSlotId === slot.id ? t("detail.slotBooking") : t("detail.slotBook")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
