import { Dot, type ProjectSlot } from "../display/Dot";
import { ProgressBar } from "../display/ProgressBar";

/* Ported from designs/components/tasks/ProjectItem.jsx. */
export interface ProjectItemProps {
  name?: string;
  /** Tasks on the done status. */
  done?: number;
  total?: number;
  project?: ProjectSlot;
  /** Overrides the "3/7" count with a spelled-out one: "3 van 7 klaar". */
  count?: string;
  /** dot = compact row, progress = two-line row with a full-width bar. */
  variant?: "dot" | "progress";
  active?: boolean;
  onClick?: () => void;
}

export function ProjectItem({
  name,
  done = 0,
  total = 0,
  project = 1,
  variant = "dot",
  count,
  active = false,
  onClick,
}: ProjectItemProps) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
      style={{
        display: "flex",
        flexDirection: variant === "progress" ? "column" : "row",
        alignItems: variant === "progress" ? "stretch" : "center",
        justifyContent: "space-between",
        gap: variant === "progress" ? "7px" : "var(--space-4)",
        padding: variant === "progress" ? "10px 12px" : "9px 12px",
        borderRadius: "var(--radius)",
        textDecoration: "none",
        background: active ? "var(--accent-tint)" : "transparent",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-4)",
          minWidth: 0,
        }}
      >
        <span
          style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: 0 }}
        >
          <Dot project={project} />
          <span
            style={{
              fontSize: variant === "progress" ? "14.5px" : "var(--text-md)",
              fontWeight: active ? "var(--weight-bold)" : "var(--weight-semibold)",
              color: active ? "var(--accent-text)" : "var(--text-body)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </span>
        </span>
        <span
          style={{
            fontSize: "12.5px",
            fontWeight: "var(--weight-bold)",
            color: "var(--text-muted)",
            flex: "none",
          }}
        >
          {count || `${done}/${total}`}
        </span>
      </span>
      {variant === "progress" ? (
        <ProgressBar value={pct} project={project} width="full" />
      ) : null}
    </a>
  );
}
