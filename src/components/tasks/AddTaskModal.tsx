import { useMemo, useState, type CSSProperties } from "react";
import { nl } from "@/i18n";
import { isAppError } from "@/lib/ipc";
import type { ReminderDefinition } from "@/lib/beheerTypes";
import type { CreateTodoInput, Todo } from "@/lib/taskTypes";
import { useStatuses, useAttributes } from "@/lib/beheerQueries";
import { useProjects, useTodoMutations } from "@/lib/taskQueries";
import { Modal } from "@/components/overlays/Modal";
import { SectionLabel } from "@/components/display/SectionLabel";
import { ReminderPopover } from "@/components/reminders/ReminderPopover";
import { reminderSummary } from "@/pages/TemplatesPage";
import { DateField } from "@/components/forms/DateField";
import { TimeField } from "@/components/forms/TimeField";
import { TaskAttributeField } from "./TaskAttributeField";
import { tintFromHex } from "@/lib/colorTint";

/**
 * Taak toevoegen (spec §1.1). Eén sheet: de snelvelden staan er altijd,
 * "Alle velden…" vouwt omschrijving, kenmerken en links open. Geen
 * sjabloonkeuze — dat kan alleen via een project uit een sjabloon.
 */
export function AddTaskModal({
  defaultProjectId = null,
  defaultStatusId = null,
  onClose,
  onCreated,
}: {
  defaultProjectId?: number | null;
  /** Kanban `+` per kolomkop vult de status voor. */
  defaultStatusId?: number | null;
  onClose: () => void;
  onCreated?: (todo: Todo) => void;
}) {
  const { data: statuses = [] } = useStatuses();
  const { data: projects = [] } = useProjects(["active", "completed"]);
  const { data: attributes = [] } = useAttributes();
  const m = useTodoMutations();

  const [full, setFull] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<number | null>(defaultProjectId);
  const [position, setPosition] = useState<number | null>(null);
  const [statusId, setStatusId] = useState<number | null>(defaultStatusId);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [attrValues, setAttrValues] = useState<
    Record<number, import("@/lib/taskTypes").TodoAttributeValue>
  >({});
  const [links, setLinks] = useState<{ url: string; title: string }[]>([]);
  const [reminders, setReminders] = useState<ReminderDefinition[]>([]);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const project = projects.find((p) => p.id === projectId) ?? null;
  // De keuzelijst draagt de kleur van de status die nu geldt (of de standaard).
  const statusTint = tintFromHex(
    (statusId != null
      ? statuses.find((s) => s.id === statusId)
      : statuses.find((s) => s.isDefault)
    )?.color,
  );
  const stepCount = useMemo(
    () => projects.find((p) => p.id === projectId)?.todoCount ?? 0,
    [projects, projectId],
  );
  const relevantAttributes = attributes.filter(
    (a) => a.scope === "global" || (project && a.templateId === project.templateId),
  );

  const submit = async () => {
    if (!title.trim()) return;
    setError(null);
    const input: CreateTodoInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      projectId,
      position: projectId != null ? position : null,
      statusId,
      deadlineDate: date || null,
      deadlineTime: date && time ? time : null,
    };
    try {
      const todo = await m.create.mutateAsync(input);
      for (const [attributeId, value] of Object.entries(attrValues)) {
        await m.setAttributeValue.mutateAsync({
          todoId: todo.id,
          value: { ...value, attributeId: Number(attributeId) },
        });
      }
      for (const l of links) {
        if (l.url.trim())
          await m.addLink.mutateAsync({
            todoId: todo.id,
            url: l.url.trim(),
            title: l.title.trim() || null,
          });
      }
      for (const def of reminders) {
        await m.addReminder.mutateAsync({ todoId: todo.id, definition: def });
      }
      onCreated?.(todo);
      onClose();
    } catch (e) {
      setError(isAppError(e) ? e.message : nl.beheer.loadError);
    }
  };

  return (
    <Modal
      title={full ? nl.tasks.fullAddTitle : nl.tasks.quickAddTitle}
      width={full ? 640 : 520}
      confirmLabel={nl.tasks.add}
      confirmDisabled={!title.trim() || m.create.isPending}
      onConfirm={submit}
      onClose={onClose}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <Field label={nl.tasks.titleLabel}>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={nl.tasks.titlePlaceholder}
            style={input}
          />
        </Field>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--space-5)",
          }}
        >
          <Field label={nl.tasks.projectLabel}>
            <select
              value={projectId ?? ""}
              onChange={(e) => {
                setProjectId(e.target.value ? Number(e.target.value) : null);
                setPosition(null);
              }}
              style={input}
            >
              <option value="">{nl.tasks.noProject}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={nl.tasks.statusLabel}>
            <select
              value={statusId ?? ""}
              onChange={(e) =>
                setStatusId(e.target.value ? Number(e.target.value) : null)
              }
              style={
                statusTint
                  ? {
                      ...input,
                      color: statusTint.color,
                      borderColor: statusTint.borderColor,
                      background: statusTint.background,
                    }
                  : input
              }
            >
              <option value="">
                {statuses.find((s) => s.isDefault)?.name ?? "Standaard"}
              </option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {projectId != null ? (
          <Field label={nl.tasks.stepLabel}>
            <select
              value={position ?? ""}
              onChange={(e) =>
                setPosition(e.target.value ? Number(e.target.value) : null)
              }
              style={{ ...input, width: "auto" }}
            >
              <option value="">{nl.tasks.stepEnd}</option>
              {Array.from({ length: stepCount }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--space-5)",
          }}
        >
          <Field label={nl.tasks.deadlineDate}>
            <DateField value={date} onChange={setDate} style={input} />
          </Field>
          <Field label={nl.tasks.deadlineTime}>
            <TimeField
              value={time}
              disabled={!date}
              onChange={setTime}
              style={{ ...input, opacity: date ? 1 : 0.5 }}
            />
          </Field>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
            alignItems: "flex-start",
          }}
        >
          <SectionLabel>{nl.tasks.remindersLabel}</SectionLabel>
          {reminders.map((r, i) => (
            <div key={i} style={reminderRow}>
              <span style={{ flex: 1 }}>{reminderSummary(r)}</span>
              <button
                type="button"
                onClick={() => setReminders((prev) => prev.filter((_, j) => j !== i))}
                style={linkBtn}
              >
                {nl.beheer.delete}
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setReminderOpen(true)}
            style={secondaryBtn}
          >
            {nl.tasks.addReminder}
          </button>
        </div>

        {full ? (
          <>
            <Field label={nl.tasks.descriptionLabel}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{
                  ...input,
                  height: "auto",
                  padding: "8px 11px",
                  resize: "vertical",
                }}
              />
            </Field>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-4)",
              }}
            >
              <SectionLabel>{nl.tasks.attributesLabel}</SectionLabel>
              {relevantAttributes.length === 0 ? (
                <span style={hint}>{nl.tasks.noAttributes}</span>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-5)",
                  }}
                >
                  {relevantAttributes.map((a) => (
                    <TaskAttributeField
                      key={a.id}
                      attribute={a}
                      value={attrValues[a.id]}
                      onChange={(v) =>
                        setAttrValues((prev) => ({ ...prev, [a.id]: v }))
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-4)",
                alignItems: "flex-start",
              }}
            >
              <SectionLabel>{nl.tasks.linksLabel}</SectionLabel>
              {links.map((l, i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: "var(--space-4)", width: "100%" }}
                >
                  <input
                    value={l.url}
                    onChange={(e) =>
                      setLinks((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, url: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder={nl.tasks.linkUrlPlaceholder}
                    style={{ ...input, flex: 2 }}
                  />
                  <input
                    value={l.title}
                    onChange={(e) =>
                      setLinks((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, title: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder={nl.tasks.linkTitleLabel}
                    style={{ ...input, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                    style={linkBtn}
                  >
                    {nl.beheer.delete}
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setLinks((prev) => [...prev, { url: "", title: "" }])}
                style={secondaryBtn}
              >
                {nl.tasks.addLink}
              </button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => setFull(true)} style={linkBtn}>
            {nl.tasks.fullFormLink}
          </button>
        )}

        {error ? (
          <span style={{ ...hint, color: "var(--late-fg)" }}>{error}</span>
        ) : null}
      </div>

      {reminderOpen ? (
        <div role="presentation" onClick={() => setReminderOpen(false)} style={overlay}>
          <div onClick={(e) => e.stopPropagation()}>
            <ReminderPopover
              statuses={statuses}
              allowSiblings={projectId != null}
              context="task"
              submitLabel={nl.beheer.add}
              onCancel={() => setReminderOpen(false)}
              onSubmit={(def) => {
                setReminders((prev) => [...prev, def]);
                setReminderOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <SectionLabel>{label}</SectionLabel>
      {children}
    </label>
  );
}

const input: CSSProperties = {
  minHeight: 38,
  height: 38,
  border: "var(--border-width) solid var(--border-default)",
  borderRadius: "var(--radius)",
  padding: "0 12px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-body)",
  background: "var(--surface-card)",
  width: "100%",
};
const hint: CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: "var(--weight-semibold)",
  color: "var(--text-muted)",
};
const secondaryBtn: CSSProperties = {
  height: 32,
  border: "var(--border-width) solid var(--border-default)",
  background: "var(--surface-card)",
  borderRadius: "var(--radius)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-base)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-secondary)",
  padding: "0 14px",
  cursor: "pointer",
};
const linkBtn: CSSProperties = {
  border: 0,
  background: "transparent",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-sm)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-link)",
  cursor: "pointer",
  padding: 0,
};
const reminderRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-4)",
  width: "100%",
  fontSize: "var(--text-sm)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-body)",
};
const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "var(--scrim)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 60,
};
