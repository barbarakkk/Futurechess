import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

export function formatSlotRange(startTime: string, endTime: string): string {
  const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
  const timeFmt = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });
  const start = new Date(startTime);
  const end = new Date(endTime);
  return `${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`;
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  GEL: "₾",
  EUR: "€",
};

export function formatHourlyRate(rate: number, currency?: string | null): string {
  const symbol = (currency && CURRENCY_SYMBOLS[currency]) || "";
  return `${symbol}${rate}`;
}
