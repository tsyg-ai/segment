import type { ReactNode } from "react";

/* Ported from designs/components/display/MetaChip.jsx.
   Every chip is bordered: one radius, 3px 9px, 12px/700, one of four pairs. */

const CHIP_TONES = {
  late: {
    color: "var(--late-fg)",
    background: "var(--late-bg)",
    borderColor: "var(--late-border)",
  },
  today: {
    color: "var(--today-fg)",
    background: "var(--today-bg)",
    borderColor: "var(--today-border)",
  },
  neutral: {
    color: "var(--neutral-fg)",
    background: "var(--neutral-bg)",
    borderColor: "var(--neutral-border)",
  },
  done: {
    color: "var(--done-fg)",
    background: "var(--done-bg)",
    borderColor: "var(--done-border)",
  },
} as const;

export type ChipTone = keyof typeof CHIP_TONES;

export interface MetaChipProps {
  /** late = overdue (terracotta), today = due today (ochre), neutral = future date, done = klaar (teal). */
  tone?: ChipTone;
  /** Dutch relative or short date: "3 dagen te laat", "Vandaag 14:00", "do 4 sep". */
  children?: ReactNode;
}

export function MetaChip({ tone = "neutral", children }: MetaChipProps) {
  const t = CHIP_TONES[tone] ?? CHIP_TONES.neutral;
  return (
    <span
      style={{
        fontSize: "var(--text-xs)",
        fontWeight: "var(--weight-bold)",
        borderRadius: "var(--radius)",
        padding: "3px 9px",
        whiteSpace: "nowrap",
        borderWidth: "var(--border-width)",
        borderStyle: "solid",
        ...t,
      }}
    >
      {children}
    </span>
  );
}
