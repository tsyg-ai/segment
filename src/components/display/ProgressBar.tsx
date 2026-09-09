import type { ProjectSlot } from "./Dot";

/* Ported from designs/components/display/ProgressBar.jsx. */

const BAR_COLORS: Record<string, string> = {
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

export interface ProgressBarProps {
  /** Percentage of tasks on the done status, 0–100. */
  value?: number;
  project?: ProjectSlot;
  /** Fixed px width (82 in group headers) or "full" in the project column. */
  width?: number | "full";
}

export function ProgressBar({ value = 0, project = 1, width = 82 }: ProgressBarProps) {
  return (
    <span
      style={{
        width: width === "full" ? "100%" : width,
        height: "var(--progress-h)",
        borderRadius: "var(--radius-round)",
        background: "var(--paper-700)",
        display: "block",
        overflow: "hidden",
        flex: "none",
      }}
    >
      <span
        style={{
          display: "block",
          height: "var(--progress-h)",
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: BAR_COLORS[String(project)] ?? BAR_COLORS[1],
          borderRadius: "var(--radius-round)",
        }}
      />
    </span>
  );
}
