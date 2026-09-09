import { Fragment, type ReactNode } from "react";

/* Ported from designs/components/display/FieldRow.jsx. One label/value pattern
   shared by deadline and kenmerken in the detail panel. Values are edited by
   clicking them — there is no separate "Wijzigen" button. */
export interface FieldRowProps {
  /** Kenmerk name, e.g. "Prioriteit", "Deadline". */
  label?: ReactNode;
  children?: ReactNode;
  /** Colours the value; use "today"/"late" for deadlines. */
  tone?: "default" | "today" | "late";
  onClick?: () => void;
}

export function FieldRow({
  label,
  children,
  tone = "default",
  onClick,
}: FieldRowProps) {
  const color =
    tone === "today"
      ? "var(--today-fg)"
      : tone === "late"
        ? "var(--late-fg)"
        : "var(--text-primary)";
  return (
    <Fragment>
      <span
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: "var(--weight-semibold)",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </span>
      <span
        onClick={onClick}
        style={{
          fontSize: "var(--text-base)",
          fontWeight: "var(--weight-bold)",
          color,
          justifySelf: "start",
          cursor: onClick ? "pointer" : "default",
        }}
      >
        {children}
      </span>
    </Fragment>
  );
}
