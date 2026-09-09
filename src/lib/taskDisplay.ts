import type { Status } from "./statusTypes";
import type { StatusTone } from "@/components/display/StatusPill";
import type { ChipTone } from "@/components/display/MetaChip";
import { formatShortDate, formatShortDateTime } from "@/i18n/format";

/** Map a user status to one of the three StatusPill tones. */
export function statusTone(status: Status | undefined): StatusTone {
  if (!status) return "todo";
  if (status.isDone) return "done";
  if (status.position === 2) return "busy";
  return "todo";
}

/** Short Dutch deadline text + tone, or null when there is no deadline. */
export function deadlineChip(
  date: string | null,
  time: string | null,
  today = new Date(),
): { text: string; tone: ChipTone } | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time ?? "00:00").split(":").map(Number);
  const when = new Date(y, (m ?? 1) - 1, d ?? 1, hh || 0, mm || 0);
  const text = time ? formatShortDateTime(when) : formatShortDate(when);

  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDay = new Date(y, (m ?? 1) - 1, d ?? 1);
  let tone: ChipTone = "neutral";
  if (dueDay < startOfToday) tone = "late";
  else if (dueDay.getTime() === startOfToday.getTime()) tone = "today";
  return { text, tone };
}
