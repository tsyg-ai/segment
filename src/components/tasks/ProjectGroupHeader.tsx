import { Fragment } from "react";
import { Dot, type ProjectSlot } from "../display/Dot";
import { ProgressBar } from "../display/ProgressBar";

/* Ported from designs/components/tasks/ProjectGroupHeader.jsx. */
export interface ProjectGroupHeaderProps {
  name?: string;
  done?: number;
  total?: number;
  project?: ProjectSlot;
  /** Overdue count; hidden when 0. */
  late?: number;
  /** Replaces the count + bar, e.g. "3 zichtbaar" for losse taken. */
  note?: string;
}

export function ProjectGroupHeader({
  name,
  done = 0,
  total = 0,
  project = 1,
  late = 0,
  note,
}: ProjectGroupHeaderProps) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "11px",
        padding: "0 var(--space-2)",
        flexWrap: "wrap",
      }}
    >
      <Dot project={project} size="lg" />
      <h2
        style={{
          margin: 0,
          fontSize: "var(--text-xl)",
          fontWeight: "var(--weight-black)",
        }}
      >
        {name}
      </h2>
      {note ? (
        <span
          style={{
            fontSize: "var(--text-base)",
            fontWeight: "var(--weight-bold)",
            color: "var(--text-muted)",
          }}
        >
          {note}
        </span>
      ) : (
        <Fragment>
          <span
            style={{
              fontSize: "var(--text-base)",
              fontWeight: "var(--weight-bold)",
              color: "var(--text-muted)",
            }}
          >
            {done} van {total} klaar
          </span>
          <ProgressBar value={pct} project={project} />
        </Fragment>
      )}
      {late > 0 ? (
        <span
          style={{
            fontSize: "var(--text-base)",
            fontWeight: "var(--weight-bold)",
            color: "var(--late-fg)",
          }}
        >
          {late} te laat
        </span>
      ) : null}
    </div>
  );
}
