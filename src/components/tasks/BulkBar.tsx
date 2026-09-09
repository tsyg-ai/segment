import { Fragment } from "react";
import { Button } from "../core/Button";

/* Ported from designs/components/tasks/BulkBar.jsx. Appears only when a selection
   is active. Degrades to Status / Deadline / ··· when a side panel is open. */
export interface BulkBarProps {
  /** Number of selected tasks. */
  count?: number;
  /** Drops secondary actions when a side panel is open (< ~1000px of main). */
  compact?: boolean;
  onClear?: () => void;
}

export function BulkBar({ count = 0, compact = false, onClear }: BulkBarProps) {
  return (
    <div
      style={{
        background: "var(--surface-toolbar)",
        padding: "var(--space-5) var(--gutter)",
        flex: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: compact ? "var(--space-5)" : "var(--space-6)",
          flexWrap: "nowrap",
        }}
      >
        <span
          style={{
            fontSize: "14.5px",
            fontWeight: "var(--weight-black)",
            color: "var(--text-on-dark)",
            whiteSpace: "nowrap",
          }}
        >
          {count}{" "}
          {compact
            ? "geselecteerd"
            : count === 1
              ? "taak geselecteerd"
              : "taken geselecteerd"}
        </span>
        <span
          style={{
            width: 1,
            height: 20,
            background: "var(--border-toolbar-divider)",
            flex: "none",
          }}
        />
        <Button variant="toolbar">{compact ? "Status" : "Status wijzigen"}</Button>
        <Button variant="toolbar">{compact ? "Deadline" : "Deadline wijzigen"}</Button>
        {compact ? (
          <Button variant="toolbar" icon="ellipsis" style={{ padding: "0 10px" }} />
        ) : (
          <Fragment>
            <Button variant="toolbar">Naar project verplaatsen</Button>
            <Button variant="danger" icon="trash-2">
              Verwijderen
            </Button>
          </Fragment>
        )}
        <div style={{ flex: 1 }} />
        <Button
          variant="ghost"
          onClick={onClear}
          style={{ color: "var(--text-on-dark-muted)", padding: "0 4px" }}
        >
          {compact ? "Wissen" : "Selectie wissen"}
        </Button>
      </div>
    </div>
  );
}
