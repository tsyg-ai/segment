import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/core/Button";
import { nl } from "@/i18n";

/**
 * The one confirmation-dialog shape in the system (readme "Beheerpagina's"):
 * 520px, 11px radius, the *question* in the header, the *consequence* in the
 * body, the *verb* in the primary button. An optional ochre warning band and a
 * muted footer note match the mockups (`_status-bewerken`, `_kenmerken` …).
 */
export interface DialogProps {
  title: string;
  /** One or two sentences naming what will change. */
  description?: ReactNode;
  /** Extra body content (radio choices, "wat er verandert" list). */
  children?: ReactNode;
  /** Ochre attention band directly under the body. */
  warning?: ReactNode;
  /** Muted line on the left of the footer. */
  note?: ReactNode;
  confirmLabel: string;
  confirmVariant?: "primary" | "danger";
  /** Disable the confirm button (invalid form / pending mutation). */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Dialog({
  title,
  description,
  children,
  warning,
  note,
  confirmLabel,
  confirmVariant = "primary",
  confirmDisabled,
  onConfirm,
  onCancel,
}: DialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="presentation"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        zIndex: 50,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: "100%",
          background: "var(--surface-card)",
          border: "var(--border-width) solid var(--border-default)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow-dialog)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "18px 22px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
            borderBottom: "var(--border-width) solid var(--border-subtle)",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "var(--text-2xl)",
              fontWeight: "var(--weight-black)",
              letterSpacing: "-0.3px",
            }}
          >
            {title}
          </h2>
          {description ? (
            <span
              style={{
                fontSize: "var(--text-md)",
                fontWeight: "var(--weight-semibold)",
                color: "var(--text-secondary)",
                lineHeight: "var(--leading-normal)",
              }}
            >
              {description}
            </span>
          ) : null}
        </div>

        {children ? (
          <div
            style={{
              padding: "16px 22px",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-6)",
            }}
          >
            {children}
          </div>
        ) : null}

        {warning ? (
          <div
            style={{
              background: "var(--today-bg)",
              borderTop: "var(--border-width) solid var(--today-border)",
              borderBottom: "var(--border-width) solid var(--today-border)",
              padding: "11px 22px",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-4)",
              fontSize: "var(--text-md)",
              fontWeight: "var(--weight-bold)",
              color: "var(--today-fg)",
              lineHeight: "var(--leading-snug)",
            }}
          >
            {warning}
          </div>
        ) : null}

        <div
          style={{
            padding: "14px 22px 18px",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-5)",
            borderTop: "var(--border-width) solid var(--border-subtle)",
          }}
        >
          {note ? (
            <span
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: "var(--weight-bold)",
                color: "var(--text-muted)",
                lineHeight: "var(--leading-snug)",
                minWidth: 0,
              }}
            >
              {note}
            </span>
          ) : null}
          <div style={{ flex: 1, minWidth: 8 }} />
          <Button variant="secondary" onClick={onCancel}>
            {nl.beheer.cancel}
          </Button>
          <Button
            variant={confirmVariant === "danger" ? "danger" : "primary"}
            disabled={confirmDisabled}
            onClick={onConfirm}
            style={
              confirmVariant === "danger"
                ? { background: "var(--late-fg)", color: "var(--text-on-dark)" }
                : undefined
            }
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
