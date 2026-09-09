import type { ReactNode } from "react";

/* Ported from designs/components/core/Badge.jsx. Note: the sidebar carries no
   badges (readme) — this is for keycaps and the odd count elsewhere. */

const BADGE_TONES = {
  alert: { background: "var(--terracotta-600)", color: "var(--text-on-dark)" },
  count: { background: "transparent", color: "var(--text-muted)" },
  accent: { background: "var(--accent-text)", color: "var(--text-on-dark)" },
  key: {
    background: "var(--surface-card)",
    color: "var(--text-secondary)",
    border: "var(--border-width) solid var(--border-default)",
  },
} as const;

export interface BadgeProps {
  /** alert = terracotta attention count, count = bare grey number, accent = teal on dark, key = keycap. */
  tone?: keyof typeof BADGE_TONES;
  children?: ReactNode;
}

export function Badge({ tone = "count", children }: BadgeProps) {
  const t = BADGE_TONES[tone] ?? BADGE_TONES.count;
  return (
    <span
      style={{
        fontSize: tone === "count" ? "var(--text-sm)" : "var(--text-xs)",
        fontWeight: "var(--weight-bold)",
        borderRadius: tone === "count" ? 0 : "var(--radius-sm)",
        padding: tone === "count" ? 0 : "1px 8px",
        whiteSpace: "nowrap",
        ...t,
      }}
    >
      {children}
    </span>
  );
}
