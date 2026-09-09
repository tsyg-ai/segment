import type { ReactNode } from "react";

/**
 * Page header (readme: "Chrome per screen"). Row 1 is the title line and never
 * wraps; the optional `toolbar` is a second row for the view-tabs + filter /
 * sorting / grouping controls (designs: Takenlijst / Tabelweergave / Kanban /
 * Kalender all put the tabs on their own row).
 */
export function ViewHeader({
  title,
  meta,
  actions,
  toolbar,
}: {
  title: string;
  /** Row 1, right after the title — e.g. the "N van M zichtbaar" count. */
  meta?: ReactNode;
  /** Row 1, trailing — the single screen-level primary action. */
  actions?: ReactNode;
  /** Row 2 — full-width tab + control strip. */
  toolbar?: ReactNode;
}) {
  return (
    <header
      style={{
        flex: "none",
        display: "flex",
        flexDirection: "column",
        padding: `var(--space-9) var(--gutter) ${toolbar ? "0" : "var(--space-7)"}`,
        borderBottom: "var(--border-width) solid var(--border-default)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-8)",
          whiteSpace: "nowrap",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-3xl)",
            fontWeight: "var(--weight-black)",
            letterSpacing: "var(--tracking-title)",
          }}
        >
          {title}
        </h1>
        {meta}
        <div style={{ flex: 1 }} />
        {actions}
      </div>
      {toolbar ? (
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "var(--space-8)",
            flexWrap: "wrap",
            marginTop: "var(--space-6)",
          }}
        >
          {toolbar}
        </div>
      ) : null}
    </header>
  );
}
