import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/core/Button";
import { IconButton } from "@/components/core/IconButton";
import { nl } from "@/i18n";

/**
 * A plain centered modal sheet (scrim + 11px card + dialog shadow). Wider than
 * {@link Dialog} and scrollable in the body — used for the "Nieuw kenmerk" and
 * "Nieuw sjabloon" forms (mockups `_nieuw-kenmerk`, `_nieuw-sjabloon`).
 */
export function Modal({
  title,
  description,
  width = 716,
  children,
  footerNote,
  confirmLabel,
  confirmDisabled,
  onConfirm,
  onClose,
}: {
  title: string;
  description?: ReactNode;
  width?: number;
  children: ReactNode;
  footerNote?: ReactNode;
  confirmLabel: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "72px 34px 34px",
        zIndex: 50,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: "100%",
          maxHeight: "100%",
          background: "var(--surface-card)",
          border: "var(--border-width) solid var(--border-window)",
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
            flex: "none",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-5)" }}
          >
            <h2
              style={{
                margin: 0,
                flex: 1,
                fontSize: "var(--text-2xl)",
                fontWeight: "var(--weight-black)",
                letterSpacing: "-0.3px",
              }}
            >
              {title}
            </h2>
            <IconButton icon="x" label={nl.beheer.close} onClick={onClose} />
          </div>
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

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "16px 22px",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-9)",
          }}
        >
          {children}
        </div>

        <div
          style={{
            padding: "14px 22px 18px",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-5)",
            borderTop: "var(--border-width) solid var(--border-subtle)",
            flex: "none",
          }}
        >
          {footerNote ? (
            <span
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: "var(--weight-bold)",
                color: "var(--text-muted)",
                lineHeight: "var(--leading-snug)",
                minWidth: 0,
              }}
            >
              {footerNote}
            </span>
          ) : null}
          <div style={{ flex: 1, minWidth: 8 }} />
          <Button variant="secondary" onClick={onClose}>
            {nl.beheer.cancel}
          </Button>
          <Button disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
