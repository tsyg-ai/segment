import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/core/Button";
import { IconButton } from "@/components/core/IconButton";
import { Icon } from "@/components/core/Icon";
import { SectionLabel } from "@/components/display/SectionLabel";

/* Shared building blocks for the three beheerpagina's — the two-column pattern
   from designs/readme.md ("Beheerpagina's"): a list on the left, a detail
   panel on the right. Chrome is `flex:none`; only the list body scrolls. */

export function BeheerLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      {children}
    </div>
  );
}

export function BeheerHeader({
  title,
  count,
  intro,
  primaryLabel,
  onPrimary,
}: {
  title: string;
  count?: string;
  intro?: ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
}) {
  return (
    <header
      style={{
        flex: "none",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
        padding: "var(--space-9) var(--gutter) var(--space-7)",
        borderBottom: "var(--border-width) solid var(--border-default)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-7)" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-3xl)",
            fontWeight: "var(--weight-black)",
            letterSpacing: "var(--tracking-title)",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </h1>
        {count ? (
          <span
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
            }}
          >
            {count}
          </span>
        ) : null}
        <div style={{ flex: 1 }} />
        {primaryLabel && onPrimary ? (
          <Button size="major" icon="plus" onClick={onPrimary}>
            {primaryLabel}
          </Button>
        ) : null}
      </div>
      {intro ? (
        <span
          style={{
            fontSize: "var(--text-md)",
            fontWeight: "var(--weight-semibold)",
            color: "var(--text-secondary)",
            lineHeight: "var(--leading-snug)",
          }}
        >
          {intro}
        </span>
      ) : null}
    </header>
  );
}

export function BeheerColumns({
  children,
  panel,
}: {
  children: ReactNode;
  panel?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", minHeight: 0, flex: 1 }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "auto",
          padding: "var(--space-8) var(--gutter) var(--space-12)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-9)",
        }}
      >
        {children}
      </div>
      {panel}
    </div>
  );
}

export function DetailPanel({
  kicker,
  title,
  subtitle,
  onClose,
  children,
}: {
  kicker: string;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <aside
      style={{
        width: "var(--detail-panel-w)",
        flex: "none",
        background: "var(--surface-panel)",
        borderLeft: "var(--border-width) solid var(--border-default)",
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "var(--border-width) solid var(--border-default)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          <span
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: "var(--weight-bold)",
              color: "var(--text-secondary)",
              whiteSpace: "nowrap",
            }}
          >
            {kicker}
          </span>
          <div style={{ flex: 1 }} />
          <IconButton icon="x" label="Paneel sluiten" onClick={onClose} />
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: "var(--text-2xl)",
            fontWeight: "var(--weight-black)",
            letterSpacing: "-0.3px",
            lineHeight: "var(--leading-snug)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
          }}
        >
          {title}
        </h2>
        {subtitle ? (
          <span
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: "var(--weight-bold)",
              color: "var(--text-muted)",
            }}
          >
            {subtitle}
          </span>
        ) : null}
      </div>
      <div
        style={{
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-9)",
        }}
      >
        {children}
      </div>
    </aside>
  );
}

export function GroupLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-5)",
        padding: "0 var(--space-2)",
      }}
    >
      <SectionLabel>{label}</SectionLabel>
      {hint ? (
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: "var(--weight-bold)",
            color: "var(--text-label)",
          }}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function ListCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--surface-card)",
        border: "var(--border-width) solid var(--border-default)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
        boxShadow: "var(--shadow-card)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function AddRowButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-5)",
        background: "var(--surface-card)",
        border: "var(--border-width-control) dashed var(--border-dashed)",
        borderRadius: "var(--radius)",
        padding: "13px 18px",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-lg)",
        fontWeight: "var(--weight-bold)",
        color: "var(--text-secondary)",
        cursor: "pointer",
        textAlign: "left",
        flex: "none",
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: "var(--radius-round)",
          background: "var(--accent-tint)",
          color: "var(--accent-text)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        <Icon name="plus" size={14} />
      </span>
      <span>{label}</span>
    </button>
  );
}

/** A plain-text danger button used inside detail panels ("… verwijderen"). */
export function DangerLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: "var(--control-h-sm)",
        border: "var(--border-width) solid var(--border-default)",
        background: "var(--surface-card)",
        borderRadius: "var(--radius)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-md)",
        fontWeight: "var(--weight-bold)",
        color: "var(--late-fg)",
        padding: "0 var(--control-pad-x-sm)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-3)",
        width: "fit-content",
      }}
    >
      <Icon name="trash-2" size={13} />
      {label}
    </button>
  );
}

export function BeheerEmpty({ message }: { message: string }) {
  return (
    <p
      style={{
        margin: 0,
        maxWidth: 460,
        fontSize: "var(--text-md)",
        fontWeight: "var(--weight-medium)",
        lineHeight: "var(--leading-normal)",
        color: "var(--text-secondary)",
      }}
    >
      {message}
    </p>
  );
}
