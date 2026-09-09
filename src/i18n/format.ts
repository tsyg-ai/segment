import { format as dfFormat } from "date-fns";
import { nl as nlLocale } from "date-fns/locale";

/* nl date/number formatting. All datetimes are LOCAL TIME with no
   stored timezone (spec §1, §6.5) — never do UTC conversion here. */

/** Weekday + short month, lowercase abbreviations: "do 4 sep". */
export function formatShortDate(date: Date): string {
  return dfFormat(date, "eee d MMM", { locale: nlLocale });
}

/** Full weekday + month, spelled out: "maandag 31 augustus". */
export function formatFullDate(date: Date): string {
  return dfFormat(date, "EEEE d MMMM", { locale: nlLocale });
}

/**
 * Parse a stored local datetime ("YYYY-MM-DD HH:MM[:SS]", or a bare date) into a
 * `Date` in the machine's local zone — never a UTC parse (spec §1, §6.5).
 */
export function parseLocalDateTime(value: string): Date {
  const [datePart, timePart = "00:00:00"] = value.trim().replace("T", " ").split(" ");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh = 0, mm = 0, ss = 0] = timePart.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh, mm, ss);
}

/** "do 4 sep, 14:00" — short date with 24h time. */
export function formatShortDateTime(date: Date): string {
  return dfFormat(date, "eee d MMM, HH:mm", { locale: nlLocale });
}

/** 24h clock: "14:00". */
export function formatTime(date: Date): string {
  return dfFormat(date, "HH:mm", { locale: nlLocale });
}

/**
 * Dutch number: comma as decimal separator, no thousands grouping for the small
 * values this app shows. Whatever the user typed comes back out — there is no
 * configured aantal decimalen to round to.
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("nl-NL", {
    maximumFractionDigits: 20,
    useGrouping: false,
  }).format(value);
}

/** "1,5 u" — number with a unit; decimals use a comma (readme). */
export function formatQuantity(value: number, unit: string): string {
  return `${formatNumber(value)} ${unit}`;
}
