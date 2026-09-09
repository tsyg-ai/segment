import { Checkbox } from "../core/Checkbox";
import { MetaChip, type ChipTone } from "../display/MetaChip";
import { StatusPill, type StatusTone } from "../display/StatusPill";

/* Ported from designs/components/tasks/TaskRow.jsx. */
export interface TaskRowProps {
  /** Position within the project (1, 2, 3…). Empty for losse taken. */
  position?: number | string;
  title?: string;
  /** Short Dutch deadline text; omit when the task has no deadline. */
  deadline?: string;
  deadlineTone?: ChipTone;
  status?: StatusTone;
  statusLabel?: string;
  /** Eigen hex van de actieve status — wint van `status`. */
  statusColor?: string | null;
  selected?: boolean;
  /** Mirrors the dichtheid setting. */
  density?: "compact" | "comfortable";
  /** Last row in a card sets false. */
  divider?: boolean;
  onToggle?: () => void;
  onOpen?: () => void;
}

export function TaskRow({
  position,
  title,
  deadline,
  deadlineTone = "neutral",
  status = "todo",
  statusLabel = "Te doen",
  statusColor,
  selected = false,
  density = "compact",
  divider = true,
  onToggle,
  onOpen,
}: TaskRowProps) {
  return (
    <div
      onClick={onOpen}
      style={{
        display: "grid",
        gridTemplateColumns: "26px 34px minmax(240px, 1fr) auto",
        gap: "var(--space-7)",
        alignItems: "center",
        padding: `${
          density === "compact"
            ? "var(--row-pad-compact)"
            : "var(--row-pad-comfortable)"
        } var(--row-pad-x)`,
        borderBottom: divider ? "var(--border-width) solid var(--border-subtle)" : "0",
        background: selected ? "var(--surface-row-selected)" : "transparent",
        cursor: "pointer",
      }}
    >
      <Checkbox checked={selected} onChange={onToggle} label="Taak selecteren" />
      <span
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: "var(--weight-black)",
          color: "var(--text-muted)",
        }}
      >
        {position}
      </span>
      <span
        style={{
          fontSize: "var(--text-md)",
          fontWeight: "var(--weight-bold)",
          lineHeight: "1.3",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {title}
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "var(--space-5)",
          minWidth: 0,
        }}
      >
        {deadline ? <MetaChip tone={deadlineTone}>{deadline}</MetaChip> : null}
        <StatusPill status={status} color={statusColor}>
          {statusLabel}
        </StatusPill>
      </div>
    </div>
  );
}
