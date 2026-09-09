import { Fragment } from "react";
import { Dot, type ProjectSlot } from "../display/Dot";
import { MetaChip, type ChipTone } from "../display/MetaChip";
import { Icon } from "../core/Icon";

/* Ported from designs/components/tasks/TaskCard.jsx. Kanban card: one taak in a
   status column. Drag moves it to another column (= another status); there is no
   manual order inside a column. */
export interface TaskCardProps {
  title: string;
  position?: number | string;
  projectName?: string;
  project?: ProjectSlot;
  deadline?: string;
  deadlineTone?: ChipTone;
  attributes?: string[];
  reminders?: number;
  done?: boolean;
  density?: "compact" | "comfortable";
  dragging?: boolean;
  onOpen?: () => void;
}

export function TaskCard({
  title,
  position,
  projectName,
  project = 1,
  deadline,
  deadlineTone = "neutral",
  attributes = [],
  reminders = 0,
  done = false,
  density = "compact",
  dragging = false,
  onOpen,
}: TaskCardProps) {
  return (
    <div
      onClick={onOpen}
      style={{
        background: "var(--surface-card)",
        border: dragging
          ? "2px solid var(--accent)"
          : "var(--border-width) solid var(--border-default)",
        borderRadius: "var(--radius)",
        boxShadow: dragging ? "var(--shadow-window)" : "var(--shadow-card)",
        transform: dragging ? "rotate(-1.2deg)" : "none",
        padding: density === "compact" ? "11px 13px" : "15px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        cursor: dragging ? "grabbing" : "grab",
        flex: "none",
        transition: "var(--transition)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-4)" }}>
        <span
          style={{
            fontSize: "var(--text-md)",
            fontWeight: "var(--weight-bold)",
            lineHeight: 1.3,
            flex: 1,
            minWidth: 0,
            textWrap: "pretty",
            color: done ? "var(--text-secondary)" : "var(--text-primary)",
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: "var(--weight-black)",
            flex: "none",
            color: done ? "var(--text-label)" : "var(--text-muted)",
          }}
        >
          {position ?? "—"}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          minWidth: 0,
        }}
      >
        {projectName ? (
          <Fragment>
            <Dot project={project} />
            <span
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: "var(--weight-medium)",
                color: done ? "var(--text-muted)" : "var(--text-secondary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {projectName}
            </span>
          </Fragment>
        ) : (
          <span
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: "var(--weight-medium)",
              color: "var(--text-label)",
            }}
          >
            Losse taak
          </span>
        )}
      </div>

      {deadline || attributes.length || reminders ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            flexWrap: "wrap",
          }}
        >
          {deadline ? <MetaChip tone={deadlineTone}>{deadline}</MetaChip> : null}
          {attributes.map((a) => (
            <span
              key={a}
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: "var(--weight-bold)",
                color: "var(--text-muted)",
                whiteSpace: "nowrap",
              }}
            >
              {a}
            </span>
          ))}
          {reminders ? (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "var(--text-xs)",
                fontWeight: "var(--weight-bold)",
                color: "var(--text-muted)",
              }}
            >
              <Icon name="bell" size={13} />
              {reminders}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
