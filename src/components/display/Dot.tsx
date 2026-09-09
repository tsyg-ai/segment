/* Ported from designs/components/display/Dot.jsx. Project identity ramp only —
   a dot must never read as an urgency signal. */

export type ProjectSlot =
  1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | "none";

const DOT_COLORS: Record<string, string> = {
  1: "var(--project-1)",
  2: "var(--project-2)",
  3: "var(--project-3)",
  4: "var(--project-4)",
  5: "var(--project-5)",
  6: "var(--project-6)",
  7: "var(--project-7)",
  8: "var(--project-8)",
  9: "var(--project-9)",
  10: "var(--project-10)",
  11: "var(--project-11)",
  12: "var(--project-12)",
  13: "var(--project-13)",
  14: "var(--project-14)",
  15: "var(--project-15)",
  16: "var(--project-16)",
  none: "var(--project-none)",
};

export interface DotProps {
  /** Project accent slot; "none" is the grey dot used for losse taken. */
  project?: ProjectSlot;
  /** sm = 9px (sidebar, panel), lg = 10px (group header). */
  size?: "sm" | "lg";
}

export function Dot({ project = 1, size = "sm" }: DotProps) {
  return (
    <span
      style={{
        width: size === "lg" ? "var(--dot-size-lg)" : "var(--dot-size)",
        height: size === "lg" ? "var(--dot-size-lg)" : "var(--dot-size)",
        borderRadius: "var(--radius-round)",
        flex: "none",
        background: DOT_COLORS[String(project)] ?? DOT_COLORS[1],
      }}
    />
  );
}
