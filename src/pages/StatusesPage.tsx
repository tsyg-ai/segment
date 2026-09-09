import { useMemo, useState } from "react";
import { nl } from "@/i18n";
import { STATUS_COLORS, type Status } from "@/lib/statusTypes";
import { useStatuses, useStatusMutations } from "@/lib/beheerQueries";
import { isAppError } from "@/lib/ipc";
import {
  BeheerColumns,
  BeheerHeader,
  BeheerLayout,
  DangerLink,
  DetailPanel,
  GroupLabel,
  ListCard,
} from "@/components/beheer/Scaffold";
import { SortableList } from "@/components/beheer/SortableList";
import { Dialog } from "@/components/overlays/Dialog";
import { Icon } from "@/components/core/Icon";
import { SectionLabel } from "@/components/display/SectionLabel";

type FormState = {
  open: boolean;
  editing: Status | null;
  name: string;
  color: string;
};

export function StatusesPage() {
  const { data: statuses = [], isLoading, isError } = useStatuses();
  const m = useStatusMutations();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({
    open: false,
    editing: null,
    name: "",
    color: STATUS_COLORS[0],
  });
  const [deleting, setDeleting] = useState<Status | null>(null);
  const [reassignTo, setReassignTo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => statuses.find((s) => s.id === selectedId) ?? null,
    [statuses, selectedId],
  );

  const run = async (p: Promise<unknown>) => {
    setError(null);
    try {
      await p;
      return true;
    } catch (e) {
      setError(isAppError(e) ? e.message : nl.beheer.loadError);
      return false;
    }
  };

  const openNew = () =>
    setForm({
      open: true,
      editing: null,
      name: "",
      color: STATUS_COLORS[0],
    });
  const openEdit = (s: Status) =>
    setForm({ open: true, editing: s, name: s.name, color: s.color });
  const closeForm = () => setForm((f) => ({ ...f, open: false }));

  const submitForm = async () => {
    const input = { name: form.name.trim(), color: form.color };
    if (!input.name) return;
    const ok = form.editing
      ? await run(m.update.mutateAsync({ id: form.editing.id, input }))
      : await run(m.create.mutateAsync(input));
    if (ok) closeForm();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const ok = await run(
      m.remove.mutateAsync({
        id: deleting.id,
        reassignTo: deleting.todoCount > 0 ? reassignTo : null,
      }),
    );
    if (ok) {
      setDeleting(null);
      setReassignTo(null);
      if (selectedId === deleting.id) setSelectedId(null);
    }
  };

  return (
    <BeheerLayout>
      <BeheerHeader
        title={nl.statuses.title}
        count={nl.statuses.count(statuses.length)}
        intro={nl.statuses.intro}
        primaryLabel={nl.statuses.newStatus}
        onPrimary={openNew}
      />

      <BeheerColumns
        panel={
          selected ? (
            <StatusDetail
              status={selected}
              index={statuses.findIndex((s) => s.id === selected.id) + 1}
              total={statuses.length}
              onClose={() => setSelectedId(null)}
              onRename={() => openEdit(selected)}
              onColor={(color) =>
                void run(
                  m.update.mutateAsync({
                    id: selected.id,
                    input: { name: selected.name, color },
                  }),
                )
              }
              onDelete={() => {
                setDeleting(selected);
                setReassignTo(statuses.find((s) => s.id !== selected.id)?.id ?? null);
              }}
            />
          ) : undefined
        }
      >
        {error ? <ErrorBanner message={error} /> : null}
        {isLoading ? (
          <p style={mutedP}>{nl.beheer.loading}</p>
        ) : isError ? (
          <p style={mutedP}>{nl.beheer.loadError}</p>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
          >
            <GroupLabel label={nl.statuses.orderLabel} hint={nl.beheer.dragToReorder} />
            <ListCard>
              <SortableList
                items={statuses}
                onReorder={(ids) => void run(m.reorder.mutateAsync(ids))}
              >
                {(s, handle) => (
                  <StatusRow
                    status={s}
                    index={statuses.findIndex((x) => x.id === s.id) + 1}
                    active={s.id === selectedId}
                    onOpen={() => setSelectedId(s.id)}
                    handle={handle}
                  />
                )}
              </SortableList>
            </ListCard>
          </div>
        )}
      </BeheerColumns>

      {form.open ? (
        <Dialog
          title={
            form.editing
              ? nl.beheer.edit + " · " + form.editing.name
              : nl.statuses.newStatus
          }
          description={
            form.editing
              ? undefined
              : "Statussen gelden voor alle taken en zijn de kolommen in de kanbanweergave."
          }
          confirmLabel={form.editing ? nl.beheer.save : nl.statuses.newStatus}
          confirmDisabled={
            !form.name.trim() || m.create.isPending || m.update.isPending
          }
          onConfirm={submitForm}
          onCancel={closeForm}
          note={
            form.editing
              ? undefined
              : "Wordt in de volgorde ingevoegd vlak voor de afgerond-status."
          }
        >
          <Field label={nl.beheer.name}>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="bv. Nagekeken"
              style={textInput}
            />
          </Field>
          <Field label={nl.statuses.colorLabel}>
            <div style={swatchGrid}>
              {STATUS_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={form.color === c}
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  style={swatch(form.color === c, c)}
                />
              ))}
            </div>
          </Field>
        </Dialog>
      ) : null}

      {deleting ? (
        <Dialog
          title={nl.statuses.deleteTitle(deleting.name)}
          description={
            deleting.todoCount > 0
              ? nl.statuses.deleteBodyWithTasks(deleting.todoCount)
              : nl.statuses.deleteBodyNoTasks(deleting.name)
          }
          confirmLabel={
            deleting.todoCount > 0
              ? nl.statuses.deleteVerbWithTasks
              : nl.statuses.deleteVerbNoTasks
          }
          confirmVariant="danger"
          confirmDisabled={deleting.todoCount > 0 && reassignTo == null}
          onConfirm={confirmDelete}
          onCancel={() => {
            setDeleting(null);
            setReassignTo(null);
          }}
          note={nl.statuses.irreversible}
        >
          {deleting.todoCount > 0 ? (
            <Field label={nl.statuses.reassignLabel(deleting.todoCount)}>
              <select
                value={reassignTo ?? ""}
                onChange={(e) => setReassignTo(Number(e.target.value) || null)}
                style={textInput}
              >
                {statuses
                  .filter((s) => s.id !== deleting.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · wordt {s.todoCount + deleting.todoCount} taken
                    </option>
                  ))}
              </select>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: "var(--weight-semibold)",
                  color: "var(--text-secondary)",
                  lineHeight: "var(--leading-snug)",
                }}
              >
                {nl.statuses.reassignReminderNote}
              </span>
            </Field>
          ) : null}
        </Dialog>
      ) : null}
    </BeheerLayout>
  );
}

const mutedP: React.CSSProperties = {
  margin: 0,
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-medium)",
  color: "var(--text-secondary)",
};

const textInput: React.CSSProperties = {
  height: 40,
  border: "var(--border-width) solid var(--border-default)",
  borderRadius: "var(--radius)",
  padding: "0 13px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-body)",
  background: "var(--surface-card)",
  width: "100%",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <SectionLabel>{label}</SectionLabel>
      {children}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-4)",
        background: "var(--late-bg)",
        border: "var(--border-width) solid var(--late-border)",
        borderRadius: "var(--radius)",
        padding: "10px 14px",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--weight-bold)",
        color: "var(--late-fg)",
      }}
    >
      <Icon name="circle-alert" size={15} />
      {message}
    </div>
  );
}

function StatusRow({
  status,
  index,
  active,
  onOpen,
  handle,
}: {
  status: Status;
  index: number;
  active: boolean;
  onOpen: () => void;
  handle: import("@/components/beheer/SortableList").SortableHandleProps;
}) {
  return (
    <div
      onClick={onOpen}
      style={{
        display: "grid",
        gridTemplateColumns: "22px minmax(0,1fr) 150px 30px",
        gap: "var(--space-7)",
        alignItems: "center",
        padding: "13px 18px",
        borderBottom: "var(--border-width) solid var(--border-subtle)",
        background: active ? "var(--surface-row-selected)" : "transparent",
        cursor: "pointer",
      }}
    >
      <span
        ref={handle.ref}
        {...handle.attributes}
        {...handle.listeners}
        title={nl.beheer.dragToReorder}
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: "var(--weight-black)",
          color: "var(--text-muted)",
          cursor: "grab",
        }}
      >
        {index}
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-5)",
          minWidth: 0,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "var(--radius-round)",
            background: status.color,
            flex: "none",
          }}
        />
        <span
          style={{
            fontSize: "var(--text-lg)",
            fontWeight: "var(--weight-black)",
            letterSpacing: "-0.2px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {status.name}
        </span>
        {status.isDefault ? <Tag>{nl.statuses.defaultBadge}</Tag> : null}
        {status.isDone ? (
          <Tag tone="done">
            <Icon name="check" size={12} />
            {nl.statuses.doneBadge}
          </Tag>
        ) : null}
      </div>
      <span
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: "var(--weight-bold)",
          color: status.isDone ? "var(--accent-text)" : "var(--text-label)",
        }}
      >
        {status.isDone ? nl.statuses.remindersStop : nl.statuses.remindersFire}
      </span>
      <span
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: "var(--weight-bold)",
          color: "var(--text-muted)",
          textAlign: "right",
        }}
      >
        {status.todoCount}
      </span>
    </div>
  );
}

function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "done";
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-3)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--weight-bold)",
        color: tone === "done" ? "var(--accent-text)" : "var(--text-body)",
        background: tone === "done" ? "var(--accent-tint)" : "var(--surface-sunken)",
        border:
          tone === "done"
            ? "var(--border-width) solid var(--accent-tint-border)"
            : "var(--border-width) solid var(--border-default)",
        borderRadius: "var(--radius)",
        padding: "3px 9px",
        whiteSpace: "nowrap",
        flex: "none",
      }}
    >
      {children}
    </span>
  );
}

function StatusDetail({
  status,
  index,
  total,
  onClose,
  onRename,
  onColor,
  onDelete,
}: {
  status: Status;
  index: number;
  total: number;
  onClose: () => void;
  onRename: () => void;
  onColor: (c: string) => void;
  onDelete: () => void;
}) {
  return (
    <DetailPanel
      kicker={nl.statuses.panelPlace(index, total)}
      title={
        <>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "var(--radius-round)",
              background: status.color,
              flex: "none",
            }}
          />
          <span style={{ cursor: "pointer" }} onClick={onRename}>
            {status.name}
          </span>
          <button
            type="button"
            aria-label={nl.beheer.edit}
            onClick={onRename}
            style={{
              border: 0,
              background: "transparent",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: 0,
            }}
          >
            <Icon name="pencil" size={15} />
          </button>
        </>
      }
      subtitle={nl.statuses.todoCount(status.todoCount)}
      onClose={onClose}
    >
      <Field label={nl.statuses.colorLabel}>
        <div style={swatchGrid}>
          {STATUS_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => onColor(c)}
              style={swatch(status.color === c, c)}
            />
          ))}
        </div>
        <span style={helpText}>{nl.statuses.colorHelp}</span>
      </Field>

      {status.isDefault || status.isDone ? (
        <Field label={nl.statuses.roleLabel}>
          <span style={helpText}>
            {status.isDefault ? nl.statuses.defaultRoleNote : nl.statuses.doneRoleNote}
          </span>
        </Field>
      ) : null}

      <Field label={nl.statuses.usedByReminders}>
        <span style={helpText}>
          Status-gebaseerde herinneringen die vanaf deze status rekenen, verschijnen
          hier zodra herinneringen bestaan.
        </span>
      </Field>

      {status.isDefault || status.isDone ? null : (
        <DangerLink label={nl.statuses.deleteStatus} onClick={onDelete} />
      )}
    </DetailPanel>
  );
}

const helpText: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: "var(--weight-semibold)",
  color: "var(--text-muted)",
  lineHeight: "var(--leading-snug)",
};

/** Acht per rij — de ramp telt zestien kleuren en past niet op één regel. */
const swatchGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(8, 30px)",
  gap: "var(--space-4)",
};

const swatch = (selected: boolean, c: string): React.CSSProperties => ({
  width: 30,
  height: 30,
  borderRadius: "var(--radius-sm)",
  background: c,
  cursor: "pointer",
  border: selected
    ? "2px solid var(--text-primary)"
    : "var(--border-width) solid var(--border-default)",
  boxShadow: selected ? "0 0 0 2px var(--surface-card) inset" : undefined,
});
