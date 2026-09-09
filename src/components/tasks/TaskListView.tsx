import { useMemo, useState, type CSSProperties } from "react";
import { nl } from "@/i18n";
import { isAppError } from "@/lib/ipc";
import type { Todo } from "@/lib/taskTypes";
import type { Status } from "@/lib/statusTypes";
import { useStatuses } from "@/lib/beheerQueries";
import { useTodoMutations } from "@/lib/taskQueries";
import { statusTone, deadlineChip } from "@/lib/taskDisplay";
import { Checkbox } from "@/components/core/Checkbox";
import { MetaChip } from "@/components/display/MetaChip";
import { RowStatusMenu } from "@/components/tasks/RowStatusMenu";
import { Dialog } from "@/components/overlays/Dialog";
import { ListCard } from "@/components/beheer/Scaffold";

/**
 * Minimale takenlijst: genoeg om taken te openen in het paneel en
 * de bulk-"verwijder"-actie te tonen.
 */
export function TaskListView({
  todos,
  openId,
  onOpen,
  emptyMessage,
}: {
  todos: Todo[];
  openId: number | null;
  onOpen: (id: number | null) => void;
  emptyMessage: string;
}) {
  const { data: statuses = [] } = useStatuses();
  const m = useTodoMutations();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusById = useMemo(() => {
    const map = new Map<number, Status>();
    statuses.forEach((s) => map.set(s.id, s));
    return map;
  }, [statuses]);
  const orderedStatuses = useMemo(
    () => [...statuses].sort((a, b) => a.position - b.position),
    [statuses],
  );

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runBulkDelete = async () => {
    setError(null);
    try {
      for (const id of selected) await m.remove.mutateAsync(id);
      if (openId != null && selected.has(openId)) onOpen(null);
      setSelected(new Set());
      setConfirmBulk(false);
    } catch (e) {
      setError(isAppError(e) ? e.message : nl.beheer.loadError);
    }
  };

  if (todos.length === 0) {
    return (
      <p
        style={{
          margin: 0,
          fontSize: "var(--text-md)",
          fontWeight: "var(--weight-medium)",
          color: "var(--text-secondary)",
        }}
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {error ? (
        <span
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: "var(--weight-bold)",
            color: "var(--late-fg)",
          }}
        >
          {error}
        </span>
      ) : null}

      <ListCard>
        {todos.map((t, i) => {
          const status = statusById.get(t.statusId);
          const chip = deadlineChip(t.deadlineDate, t.deadlineTime);
          return (
            <div
              key={t.id}
              onClick={() => onOpen(t.id)}
              style={{
                display: "grid",
                gridTemplateColumns: "26px 30px minmax(0,1fr) auto",
                gap: "var(--space-6)",
                alignItems: "center",
                padding: "11px 16px",
                borderBottom:
                  i < todos.length - 1
                    ? "var(--border-width) solid var(--border-subtle)"
                    : "none",
                background:
                  t.id === openId ? "var(--surface-row-selected)" : "transparent",
                cursor: "pointer",
              }}
            >
              <span onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selected.has(t.id)}
                  onChange={() => toggle(t.id)}
                  label="Taak selecteren"
                />
              </span>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--weight-black)",
                  color: "var(--text-muted)",
                }}
              >
                {t.position ?? ""}
              </span>
              <span
                style={{
                  fontSize: "var(--text-md)",
                  fontWeight: "var(--weight-bold)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {t.title}
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "var(--space-4)",
                }}
              >
                {chip ? <MetaChip tone={chip.tone}>{chip.text}</MetaChip> : null}
                <RowStatusMenu
                  statuses={orderedStatuses}
                  value={t.statusId}
                  tone={statusTone(status)}
                  label={status?.name ?? "?"}
                  color={status?.color}
                  onPick={(statusId) =>
                    void m.setStatus.mutateAsync({ todoId: t.id, statusId })
                  }
                />
              </div>
            </div>
          );
        })}
      </ListCard>

      {selected.size > 0 ? (
        <div style={bulkBar}>
          <span
            style={{
              fontSize: "14.5px",
              fontWeight: "var(--weight-black)",
              color: "var(--text-on-dark)",
            }}
          >
            {nl.tasks.bulkSelected(selected.size)}
          </span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => setConfirmBulk(true)}
            style={bulkDeleteBtn}
          >
            {nl.tasks.bulkDelete}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            style={bulkClearBtn}
          >
            {nl.beheer.close}
          </button>
        </div>
      ) : null}

      {confirmBulk ? (
        <Dialog
          title={nl.tasks.bulkDeleteTitle(selected.size)}
          description={nl.tasks.bulkDeleteBody}
          confirmLabel={nl.tasks.bulkDelete}
          confirmVariant="danger"
          onConfirm={runBulkDelete}
          onCancel={() => setConfirmBulk(false)}
        />
      ) : null}
    </div>
  );
}

const bulkBar: CSSProperties = {
  position: "sticky",
  bottom: 0,
  display: "flex",
  alignItems: "center",
  gap: "var(--space-5)",
  background: "var(--surface-toolbar)",
  borderRadius: "var(--radius)",
  padding: "10px 16px",
};
const bulkDeleteBtn: CSSProperties = {
  height: 32,
  border: 0,
  background: "var(--surface-toolbar-control)",
  color: "var(--danger-on-dark-fg)",
  borderRadius: "var(--radius)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-base)",
  fontWeight: "var(--weight-bold)",
  padding: "0 14px",
  cursor: "pointer",
};
const bulkClearBtn: CSSProperties = {
  border: 0,
  background: "transparent",
  color: "var(--text-on-dark-muted)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-base)",
  fontWeight: "var(--weight-bold)",
  cursor: "pointer",
};
