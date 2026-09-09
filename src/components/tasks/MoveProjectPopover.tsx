import { useMemo, useState, type CSSProperties } from "react";
import { nl } from "@/i18n";
import type { Project } from "@/lib/taskTypes";
import { Icon } from "@/components/core/Icon";
import { SectionLabel } from "@/components/display/SectionLabel";

/**
 * "Naar project verplaatsen"-popover (spec §1.2): zoekveld + projectlijst +
 * "Losse taak, geen project". Het huidige project is gemarkeerd. De aanroeper
 * bepaalt zelf de waarschuwing bij kenmerkverlies.
 */
export function MoveProjectPopover({
  projects,
  currentProjectId,
  onPick,
  onClose,
}: {
  projects: Project[];
  currentProjectId: number | null;
  onPick: (targetProjectId: number | null) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () =>
      projects
        .filter((p) => p.state !== "archived")
        .filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())),
    [projects, q],
  );

  return (
    <div
      role="dialog"
      aria-label={nl.tasks.moveLabel}
      style={{
        width: 320,
        maxWidth: "100%",
        background: "var(--surface-card)",
        border: "var(--border-width) solid var(--border-window)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-popover)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "var(--border-width) solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <SectionLabel>{nl.tasks.moveLabel}</SectionLabel>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={nl.tasks.moveSearch}
          style={input}
        />
      </div>
      <div
        role="listbox"
        aria-label={nl.tasks.moveLabel}
        style={{ maxHeight: 280, overflow: "auto", padding: 6 }}
      >
        <Row
          label={nl.tasks.noProject}
          active={currentProjectId == null}
          onClick={() => onPick(null)}
        />
        {filtered.map((p) => (
          <Row
            key={p.id}
            label={p.name}
            color={p.color}
            active={p.id === currentProjectId}
            hint={p.id === currentProjectId ? nl.tasks.moveCurrent : undefined}
            onClick={() => onPick(p.id)}
          />
        ))}
      </div>
      <div
        style={{
          padding: "10px 14px",
          borderTop: "var(--border-width) solid var(--border-subtle)",
          textAlign: "right",
        }}
      >
        <button type="button" onClick={onClose} style={cancelBtn}>
          {nl.beheer.cancel}
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  color,
  active,
  hint,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-4)",
        width: "100%",
        border: 0,
        background: active ? "var(--surface-row-selected)" : "transparent",
        borderRadius: "var(--radius-sm)",
        padding: "9px 10px",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-md)",
        fontWeight: "var(--weight-bold)",
        color: "var(--text-body)",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span
        style={{
          width: "var(--dot-size)",
          height: "var(--dot-size)",
          borderRadius: "var(--radius-round)",
          background: color ?? "var(--project-none)",
          flex: "none",
        }}
      />
      <span
        style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
      >
        {label}
      </span>
      {hint ? (
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: "var(--weight-bold)",
            color: "var(--text-muted)",
          }}
        >
          {hint}
        </span>
      ) : null}
      {active ? (
        <Icon name="check" size={14} style={{ color: "var(--accent)" }} />
      ) : null}
    </button>
  );
}

const input: CSSProperties = {
  height: 34,
  border: "var(--border-width) solid var(--border-default)",
  borderRadius: "var(--radius)",
  padding: "0 11px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-bold)",
  background: "var(--surface-card)",
  width: "100%",
};
const cancelBtn: CSSProperties = {
  border: 0,
  background: "transparent",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-sm)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-link)",
  cursor: "pointer",
};
