import type { ReactNode } from "react";
import { IconButton } from "../core/IconButton";

/* Ported from designs/components/tasks/KanbanColumn.jsx. One status column on the
   Kanban board. `dropTarget` marks the column a dragged card would land in;
   `note` replaces the add button on the afgerond-status column. */
export interface KanbanColumnProps {
  name: string;
  count: number;
  tone?: "neutral" | "busy" | "done";
  note?: string;
  dropTarget?: boolean;
  onAdd?: () => void;
  children?: ReactNode;
}

export function KanbanColumn({
  name,
  count,
  tone = "neutral",
  note,
  dropTarget = false,
  onAdd,
  children,
}: KanbanColumnProps) {
  const dotColor =
    { neutral: "var(--text-muted)", busy: "var(--today-fg)", done: "var(--accent)" }[
      tone
    ] || "var(--text-muted)";
  return (
    <section
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        background: dropTarget
          ? "var(--surface-row-selected)"
          : "var(--surface-sidebar)",
        border: `var(--border-width) solid ${
          dropTarget ? "var(--accent-tint-border)" : "var(--border-default)"
        }`,
        borderRadius: "var(--radius)",
        overflow: "hidden",
        transition: "var(--transition)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-5)",
          padding: "11px 14px 10px",
          borderBottom: "var(--border-width) solid var(--border-default)",
          flex: "none",
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 999,
            background: dotColor,
            flex: "none",
          }}
        />
        <span
          style={{
            fontSize: "var(--text-base)",
            fontWeight: "var(--weight-black)",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: "var(--weight-bold)",
            color: "var(--text-muted)",
          }}
        >
          {count}
        </span>
        <div style={{ flex: 1 }} />
        {note ? (
          <span
            style={{
              fontSize: "var(--text-2xs)",
              fontWeight: "var(--weight-bold)",
              letterSpacing: "0.7px",
              textTransform: "uppercase",
              color: "var(--text-label)",
            }}
          >
            {note}
          </span>
        ) : (
          <IconButton icon="plus" label={`Taak toevoegen in ${name}`} onClick={onAdd} />
        )}
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: "var(--space-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
        }}
      >
        {children}
      </div>
    </section>
  );
}

/* The gap a dragged card leaves behind in its origin column. */
export function KanbanDropGhost({ children }: { children?: ReactNode }) {
  return (
    <div
      style={{
        border: "2px dashed var(--border-dashed)",
        borderRadius: "var(--radius)",
        height: 96,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--weight-bold)",
        color: "var(--text-label)",
      }}
    >
      {children}
    </div>
  );
}
