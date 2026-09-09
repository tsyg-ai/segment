import { useRef, useState, type CSSProperties } from "react";
import { nl } from "@/i18n";
import { isAppError } from "@/lib/ipc";
import { useOutsideClick } from "@/lib/useOutsideClick";
import { useStatuses } from "@/lib/beheerQueries";
import { useBulkMutations } from "@/lib/viewQueries";
import { useViewState } from "@/store/useViewState";
import { Button } from "@/components/core/Button";
import { DateField } from "@/components/forms/DateField";
import { TimeField } from "@/components/forms/TimeField";
import { Dialog } from "@/components/overlays/Dialog";

/**
 * De bulkbalk (spec §1.4, mockup `_bulk-subflows`). Verschijnt **alleen** bij een
 * actieve selectie. Donkere balk, live teller, acties **Status wijzigen ·
 * Deadline · Verwijderen** (bevestiging; herinneringen mee weg; posities
 * schuiven door — allemaal via de per-taak-paden). Degradeert onder krappe breedte
 * tot **Status / Deadline / ···**.
 */
export function BulkBar({ compact = false }: { compact?: boolean }) {
  const selection = useViewState((s) => s.selection);
  const clearSelection = useViewState((s) => s.clearSelection);
  const { data: statuses = [] } = useStatuses();
  const bulk = useBulkMutations();

  const [menu, setMenu] = useState<"none" | "status" | "deadline" | "more">("none");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  useOutsideClick(menu !== "none", barRef, () => setMenu("none"));

  const ids = [...selection];
  if (ids.length === 0) return null;

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      setMenu("none");
      setConfirmDelete(false);
      clearSelection();
    } catch (e) {
      setError(isAppError(e) ? e.message : nl.beheer.loadError);
    }
  };

  return (
    <div ref={barRef} style={bar}>
      <div style={row}>
        <span style={counter}>
          {compact
            ? nl.views.bulkSelectedShort(ids.length)
            : nl.tasks.bulkSelected(ids.length)}
        </span>
        <span style={divider} />

        <div style={{ position: "relative" }}>
          <Button
            variant="toolbar"
            onClick={() => setMenu(menu === "status" ? "none" : "status")}
          >
            {compact ? nl.views.bulkStatusShort : nl.views.bulkStatus}
          </Button>
          {menu === "status" ? (
            <div style={pop} role="menu">
              {statuses.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="menuitem"
                  style={popItem}
                  onClick={() =>
                    run(() => bulk.setStatus.mutateAsync({ ids, statusId: s.id }))
                  }
                >
                  {s.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ position: "relative" }}>
          <Button
            variant="toolbar"
            onClick={() => setMenu(menu === "deadline" ? "none" : "deadline")}
          >
            {compact ? nl.views.bulkDeadlineShort : nl.views.bulkDeadline}
          </Button>
          {menu === "deadline" ? (
            <div style={{ ...pop, padding: "10px", width: 240, gap: "var(--space-4)" }}>
              <DateField value={date} onChange={setDate} style={fieldInput} />
              <TimeField
                value={time}
                disabled={!date}
                onChange={setTime}
                style={{ ...fieldInput, opacity: date ? 1 : 0.5 }}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                }}
              >
                <Button
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() =>
                    run(() =>
                      bulk.setDeadline.mutateAsync({
                        ids,
                        date: date || null,
                        time: date && time ? time : null,
                      }),
                    )
                  }
                >
                  {nl.beheer.save}
                </Button>
                <Button
                  variant="secondary"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() =>
                    run(() =>
                      bulk.setDeadline.mutateAsync({ ids, date: null, time: null }),
                    )
                  }
                >
                  {nl.views.bulkDeadlineClear}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {compact ? (
          <div style={{ position: "relative" }}>
            <Button
              variant="toolbar"
              icon="ellipsis"
              style={{ padding: "0 10px" }}
              onClick={() => setMenu(menu === "more" ? "none" : "more")}
            />
            {menu === "more" ? (
              <div style={pop} role="menu">
                <button
                  type="button"
                  role="menuitem"
                  style={popItem}
                  onClick={() => setConfirmDelete(true)}
                >
                  {nl.tasks.bulkDelete}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <Button
            variant="danger"
            icon="trash-2"
            onClick={() => setConfirmDelete(true)}
          >
            {nl.tasks.bulkDelete}
          </Button>
        )}

        <div style={{ flex: 1 }} />
        {error ? <span style={errText}>{error}</span> : null}
        <Button
          variant="ghost"
          onClick={clearSelection}
          style={{ color: "var(--text-on-dark-muted)", padding: "0 4px" }}
        >
          {compact ? nl.views.bulkClearShort : nl.views.bulkClear}
        </Button>
      </div>

      {confirmDelete ? (
        <Dialog
          title={nl.tasks.bulkDeleteTitle(ids.length)}
          description={nl.tasks.bulkDeleteBody}
          confirmLabel={nl.tasks.bulkDelete}
          confirmVariant="danger"
          onConfirm={() => run(() => bulk.remove.mutateAsync(ids))}
          onCancel={() => setConfirmDelete(false)}
        />
      ) : null}
    </div>
  );
}

const bar: CSSProperties = {
  background: "var(--surface-toolbar)",
  padding: "var(--space-5) var(--gutter)",
  flex: "none",
};
const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-5)",
  flexWrap: "nowrap",
};
const counter: CSSProperties = {
  fontSize: "14.5px",
  fontWeight: "var(--weight-black)",
  color: "var(--text-on-dark)",
  whiteSpace: "nowrap",
};
const divider: CSSProperties = {
  width: 1,
  height: 20,
  background: "var(--border-toolbar-divider)",
  flex: "none",
};
const pop: CSSProperties = {
  position: "absolute",
  bottom: "calc(100% + 6px)",
  left: 0,
  zIndex: 40,
  minWidth: 160,
  background: "var(--surface-card)",
  border: "var(--border-width) solid var(--border-default)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-window)",
  padding: "6px",
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};
const popItem: CSSProperties = {
  textAlign: "left",
  border: 0,
  background: "transparent",
  borderRadius: "var(--radius-sm)",
  padding: "7px 10px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-base)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-body)",
  cursor: "pointer",
};
const fieldInput: CSSProperties = {
  height: 32,
  border: "var(--border-width) solid var(--border-default)",
  borderRadius: "var(--radius)",
  padding: "0 10px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-sm)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-body)",
  background: "var(--surface-card)",
};
const errText: CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: "var(--weight-bold)",
  color: "var(--danger-on-dark-fg)",
  whiteSpace: "nowrap",
};
