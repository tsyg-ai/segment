import type { ReactNode } from "react";
import { Icon } from "../core/Icon";

/* Ported from designs/components/forms/FilterChip.jsx. */
export interface FilterChipProps {
  /** Label including its field name, e.g. "Status: Te doen, Bezig". */
  children?: ReactNode;
  /** Omit to render a non-removable chip. */
  onRemove?: () => void;
}

export function FilterChip({ children, onRemove }: FilterChipProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        background: "var(--accent-tint)",
        border: "var(--border-width) solid var(--accent-tint-border)",
        borderRadius: "var(--radius)",
        padding: onRemove ? "5px 7px 5px 12px" : "5px 12px",
        fontSize: "var(--text-base)",
        fontWeight: "var(--weight-bold)",
        color: "var(--accent-text)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
      {onRemove ? (
        <span
          onClick={onRemove}
          style={{
            width: 19,
            height: 19,
            borderRadius: "var(--radius-round)",
            background: "var(--surface-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent-text)",
            cursor: "pointer",
            flex: "none",
          }}
        >
          <Icon name="x" size={11} />
        </span>
      ) : null}
    </span>
  );
}
