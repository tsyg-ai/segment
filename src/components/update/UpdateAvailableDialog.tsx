import { useEffect, useState, type CSSProperties } from "react";
import { listen } from "@tauri-apps/api/event";
import { nl } from "@/i18n";
import { invoke, isAppError } from "@/lib/ipc";
import type { UpdateInfo } from "@/lib/dashboardTypes";
import { Button } from "@/components/core/Button";
import { IconButton } from "@/components/core/IconButton";

/** Event the Rust updater emits when the daily check finds a new version. */
export const UPDATE_AVAILABLE_EVENT = "update://available";

/**
 * Listens for `update://available` and returns the pending update info, or
 * `null`. Safe outside Tauri (a failing `listen` is swallowed).
 */
export function useUpdateAvailable(): UpdateInfo | null {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    listen<UpdateInfo>(UPDATE_AVAILABLE_EVENT, (event) => {
      if (event.payload && typeof event.payload.version === "string") {
        setInfo(event.payload);
      }
    })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => {
        /* not inside Tauri */
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
  return info;
}

/**
 * De eigen in-app update-modal. Geen OS-dialoog. Toont versie +
 * korte toelichting; **"Nu bijwerken"** bevestigt en roept `confirm_update` aan
 * (download + install + herstart gebeuren Rust-side), **"Later"** sluit zonder
 * te downloaden. "Warn, don't scold"-toon.
 */
export function UpdateAvailableDialog({
  info,
  onDismiss,
}: {
  info: UpdateInfo;
  onDismiss: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await invoke("confirm_update", {});
      // Op succes herstart de app; deze regel wordt normaal niet bereikt.
    } catch (e) {
      setBusy(false);
      setError(isAppError(e) ? e.message : nl.update.failed);
    }
  };

  return (
    <div role="presentation" onClick={busy ? undefined : onDismiss} style={scrim}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={nl.update.title(info.version)}
        onClick={(e) => e.stopPropagation()}
        style={card}
      >
        <div style={head}>
          <h2 style={titleStyle}>{nl.update.title(info.version)}</h2>
          <IconButton icon="x" label={nl.beheer.close} onClick={onDismiss} />
        </div>

        <div style={body}>
          <p
            style={{
              margin: 0,
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-secondary)",
              lineHeight: "var(--leading-normal)",
            }}
          >
            {nl.update.body}
          </p>
          {info.notes ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: "var(--weight-bold)",
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                  color: "var(--text-muted)",
                }}
              >
                {nl.update.notesLabel}
              </span>
              <p
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--weight-medium)",
                  color: "var(--text-secondary)",
                }}
              >
                {info.notes}
              </p>
            </div>
          ) : null}
          {error ? (
            <p
              style={{
                margin: 0,
                color: "var(--late-fg)",
                fontWeight: "var(--weight-bold)",
                fontSize: "var(--text-sm)",
              }}
            >
              {error}
            </p>
          ) : null}
        </div>

        <div style={footer}>
          <div style={{ flex: 1 }} />
          <Button variant="secondary" onClick={onDismiss} disabled={busy}>
            {nl.update.later}
          </Button>
          <Button onClick={confirm} disabled={busy}>
            {busy ? nl.update.working : nl.update.confirm}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Convenience: the listener + the dialog wired together for the app shell. */
export function UpdateGate() {
  const info = useUpdateAvailable();
  const [dismissed, setDismissed] = useState(false);
  if (!info || dismissed) return null;
  return <UpdateAvailableDialog info={info} onDismiss={() => setDismissed(true)} />;
}

const scrim: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "var(--scrim)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 40,
  zIndex: 60,
};
const card: CSSProperties = {
  width: 480,
  maxWidth: "100%",
  background: "var(--surface-card)",
  border: "var(--border-width) solid var(--border-window)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-dialog)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};
const head: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--space-5)",
  padding: "18px 22px 14px",
  borderBottom: "var(--border-width) solid var(--border-subtle)",
};
const titleStyle: CSSProperties = {
  margin: 0,
  flex: 1,
  fontSize: "var(--text-2xl)",
  fontWeight: "var(--weight-black)",
  letterSpacing: "-0.3px",
};
const body: CSSProperties = {
  padding: "16px 22px",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-6)",
};
const footer: CSSProperties = {
  padding: "14px 22px 18px",
  display: "flex",
  alignItems: "center",
  gap: "var(--space-5)",
  borderTop: "var(--border-width) solid var(--border-subtle)",
};
