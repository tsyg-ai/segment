import { useMemo, useRef, useState, type CSSProperties } from "react";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { nl } from "@/i18n";
import { formatShortDateTime } from "@/i18n/format";
import { isAppError } from "@/lib/ipc";
import type { AttributeDefinition, ReminderDefinition } from "@/lib/beheerTypes";
import type { Link as TodoLink, Project, Todo } from "@/lib/taskTypes";
import type { Status } from "@/lib/statusTypes";
import { useStatuses, useAttributes } from "@/lib/beheerQueries";
import { useProjects, useTodo, useTodoMutations } from "@/lib/taskQueries";
import { statusTone, deadlineChip } from "@/lib/taskDisplay";
import { useOutsideClick } from "@/lib/useOutsideClick";
import { DangerLink } from "@/components/beheer/Scaffold";
import { SectionLabel } from "@/components/display/SectionLabel";
import { StatusPill } from "@/components/display/StatusPill";
import { tintFromHex } from "@/lib/colorTint";
import { MetaChip } from "@/components/display/MetaChip";
import { Icon } from "@/components/core/Icon";
import { IconButton } from "@/components/core/IconButton";
import { Dialog } from "@/components/overlays/Dialog";
import { DateField } from "@/components/forms/DateField";
import { TimeSelect } from "@/components/forms/TimeSelect";
import { ReminderPopover } from "@/components/reminders/ReminderPopover";
import { reminderSummary } from "@/pages/TemplatesPage";
import { TaskAttributeField } from "./TaskAttributeField";
import { MoveProjectPopover } from "./MoveProjectPopover";

/**
 * Het 352px-taakdetailpaneel (designs/_taakdetailpaneel.dc.html). Volgorde van
 * boven naar onder: kop met titel + status + "markeer als klaar", dan Project,
 * Omschrijving, Kenmerken (met de deadline als eerste rij), Links en
 * Herinneringen. Elke waarde is ter plekke te bewerken.
 */
export function TaskDetailPanel({
  todoId,
  onClose,
  onDeleted,
  onOpenOther,
}: {
  todoId: number;
  onClose: () => void;
  onDeleted: () => void;
  onOpenOther: (id: number) => void;
}) {
  const { data: todo, isLoading } = useTodo(todoId);
  const { data: statuses = [] } = useStatuses();
  const { data: attributes = [] } = useAttributes();
  const { data: projects = [] } = useProjects(["active", "completed", "archived"]);
  const m = useTodoMutations();

  const [error, setError] = useState<string | null>(null);
  const run = async (p: Promise<unknown>) => {
    setError(null);
    try {
      await p;
    } catch (e) {
      setError(isAppError(e) ? e.message : nl.beheer.loadError);
    }
  };

  if (isLoading || !todo) {
    return (
      <aside style={shell}>
        <div style={header}>
          <div style={topRow}>
            <span style={{ flex: 1 }} />
            <IconButton icon="x" label="Paneel sluiten" onClick={onClose} />
          </div>
          <span style={hint}>{nl.beheer.loading}</span>
        </div>
      </aside>
    );
  }

  const project = projects.find((p) => p.id === todo.projectId) ?? null;
  const total = project?.todoCount ?? 0;
  const currentStatus = statuses.find((s) => s.id === todo.statusId) ?? null;
  const doneStatus = statuses.find((s) => s.isDone) ?? null;
  const relevantAttributes = attributes.filter(
    (a) => a.scope === "global" || (project && a.templateId === project.templateId),
  );

  return (
    <aside style={shell}>
      {/* kop */}
      <div style={header}>
        <div style={topRow}>
          <TitleField
            value={todo.title}
            onCommit={(v) =>
              v.trim() &&
              v !== todo.title &&
              run(m.update.mutateAsync({ id: todo.id, input: { title: v.trim() } }))
            }
          />
          <IconButton icon="x" label="Paneel sluiten" onClick={onClose} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          <StatusSelect
            statuses={statuses}
            value={todo.statusId}
            onChange={(id) =>
              run(m.setStatus.mutateAsync({ todoId: todo.id, statusId: id }))
            }
          />
          {doneStatus && !currentStatus?.isDone ? (
            <button
              type="button"
              title={nl.tasks.markDone}
              aria-label={nl.tasks.markDone}
              onClick={() =>
                run(
                  m.setStatus.mutateAsync({
                    todoId: todo.id,
                    statusId: doneStatus.id,
                  }),
                )
              }
              style={markDoneBtn}
            >
              <Icon name="check" size={17} stroke={3} />
            </button>
          ) : null}
        </div>

        <span style={hint}>{nl.tasks.panelEditHint}</span>
      </div>

      {/* inhoud */}
      <div style={body}>
        {error ? <ErrorBand text={error} /> : null}

        <ProjectSection
          todo={todo}
          project={project}
          total={total}
          projects={projects}
          attributes={attributes}
          run={run}
          m={m}
        />

        {/* omschrijving */}
        <div style={section}>
          <SectionLabel>{nl.tasks.descriptionLabel}</SectionLabel>
          <Description
            value={todo.description}
            onCommit={(v) =>
              v !== todo.description &&
              run(m.update.mutateAsync({ id: todo.id, input: { description: v } }))
            }
          />
        </div>

        {/* kenmerken — deadline eerst, daarna de kenmerkvelden */}
        <div style={section}>
          <SectionLabel>{nl.tasks.attributesLabel}</SectionLabel>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-6)",
              width: "100%",
            }}
          >
            <DeadlineField
              date={todo.deadlineDate}
              time={todo.deadlineTime}
              onChange={(d, t) =>
                run(m.setDeadline.mutateAsync({ todoId: todo.id, date: d, time: t }))
              }
            />
            {relevantAttributes.map((a) => (
              <TaskAttributeField
                key={a.id}
                attribute={a}
                value={todo.attributeValues.find((v) => v.attributeId === a.id)}
                onChange={(value) =>
                  run(m.setAttributeValue.mutateAsync({ todoId: todo.id, value }))
                }
              />
            ))}
          </div>
        </div>

        {/* links */}
        <LinksSection todo={todo} run={run} m={m} />

        {/* herinneringen */}
        <RemindersSection todo={todo} statuses={statuses} run={run} m={m} />

        {/* onderaan */}
        <BottomBar
          todo={todo}
          run={run}
          m={m}
          onDeleted={onDeleted}
          onOpenOther={onOpenOther}
        />
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------- sub-parts

function TitleField({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        autoFocus
        defaultValue={value}
        onBlur={(e) => {
          onCommit(e.target.value);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        style={{
          ...editInput,
          flex: 1,
          minWidth: 0,
          width: "auto",
          fontSize: "var(--text-lg)",
          fontWeight: "var(--weight-black)",
        }}
      />
    );
  }
  return (
    <h2 style={titleWrap}>
      <span onClick={() => setEditing(true)} style={{ cursor: "text", minWidth: 0 }}>
        {value}
      </span>
      <button
        type="button"
        aria-label={nl.tasks.editTitleAria}
        onClick={() => setEditing(true)}
        style={titleEditBtn}
      >
        <Icon name="pencil" size={13} />
      </button>
    </h2>
  );
}

function StatusSelect({
  statuses,
  value,
  onChange,
}: {
  statuses: Status[];
  value: number;
  onChange: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = statuses.find((s) => s.id === value);
  return (
    <div style={{ position: "relative" }}>
      <StatusPill
        status={statusTone(current)}
        color={current?.color}
        size="md"
        onClick={() => setOpen((x) => !x)}
      >
        {current?.name ?? "?"}
      </StatusPill>
      {open ? (
        <>
          <div
            role="presentation"
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 39 }}
          />
          <div style={menu} role="listbox" aria-label={nl.tasks.statusLabel}>
            {statuses.map((s) => {
              const tint = s.id === value ? tintFromHex(s.color) : null;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={s.id === value}
                  onClick={() => {
                    onChange(s.id);
                    setOpen(false);
                  }}
                  style={
                    tint
                      ? { ...menuItem, background: tint.background, color: tint.color }
                      : menuItem
                  }
                >
                  <span
                    style={{
                      width: "var(--dot-size)",
                      height: "var(--dot-size)",
                      borderRadius: "var(--radius-round)",
                      background: s.color,
                      flex: "none",
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>{s.name}</span>
                  {s.id === value ? (
                    <Icon
                      name="check"
                      size={14}
                      style={{ color: tint?.color ?? "var(--accent)" }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function DeadlineField({
  date,
  time,
  onChange,
}: {
  date: string | null;
  time: string | null;
  onChange: (date: string | null, time: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState("");
  const [t, setT] = useState("");
  const chip = useMemo(() => deadlineChip(date, time), [date, time]);

  const open = () => {
    setD(date ?? "");
    setT(time ?? "");
    setEditing(true);
  };
  // Stuur datum én tijdstip altijd samen door — anders gaat het uur verloren.
  const commit = (nextDate: string, nextTime: string) => {
    setD(nextDate);
    setT(nextTime);
    onChange(nextDate || null, nextDate && nextTime ? nextTime : null);
  };

  return (
    <div style={attrRow}>
      <span style={attrLabel}>{nl.tasks.deadlineLabel}</span>
      <div style={{ minWidth: 0 }}>
        {editing ? (
          <div
            style={{
              display: "flex",
              gap: "var(--space-4)",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <DateField
              value={d}
              onChange={(next) => commit(next, t)}
              aria-label={nl.tasks.deadlineDate}
              style={{ ...editInput, width: "auto" }}
            />
            <TimeSelect value={t} disabled={!d} onChange={(next) => commit(d, next)} />
            {d ? (
              <button
                type="button"
                onClick={() => {
                  commit("", "");
                  setEditing(false);
                }}
                style={{ ...linkBtn, color: "var(--late-fg)" }}
              >
                {nl.tasks.deadlineClear}
              </button>
            ) : null}
            <button type="button" onClick={() => setEditing(false)} style={linkBtn}>
              {nl.beheer.close}
            </button>
          </div>
        ) : (
          <button type="button" onClick={open} style={valueBtn}>
            {chip ? (
              <MetaChip tone={chip.tone}>{chip.text}</MetaChip>
            ) : (
              <span style={hint}>{nl.tasks.deadlineNone}</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function Description({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  if (editing) {
    return (
      <textarea
        autoFocus
        defaultValue={value}
        rows={4}
        onBlur={(e) => {
          onCommit(e.target.value);
          setEditing(false);
        }}
        style={{
          ...editInput,
          alignSelf: "stretch",
          height: "auto",
          padding: "8px 11px",
          resize: "vertical",
        }}
      />
    );
  }
  if (!value.trim()) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{ ...valueBtn, alignSelf: "stretch", width: "auto" }}
      >
        <span style={hint}>{nl.tasks.noDescription}</span>
      </button>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        alignSelf: "stretch",
        alignItems: "flex-start",
      }}
    >
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{
          ...valueBtn,
          alignSelf: "stretch",
          width: "auto",
          whiteSpace: "pre-wrap",
          display: "-webkit-box",
          WebkitLineClamp: expanded ? "unset" : 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          lineHeight: "var(--leading-normal)",
        }}
      >
        {value}
      </button>
      <button type="button" onClick={() => setExpanded((x) => !x)} style={linkBtn}>
        {expanded ? nl.tasks.lessButton : nl.tasks.moreButton}
      </button>
    </div>
  );
}

function ProjectSection({
  todo,
  project,
  total,
  projects,
  attributes,
  run,
  m,
}: {
  todo: Todo;
  project: Project | null;
  total: number;
  projects: Project[];
  attributes: AttributeDefinition[];
  run: (p: Promise<unknown>) => Promise<void>;
  m: ReturnType<typeof useTodoMutations>;
}) {
  const [moveOpen, setMoveOpen] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  useOutsideClick(moveOpen, sectionRef, () => setMoveOpen(false));

  const clearedNamesFor = (targetProjectId: number | null): string => {
    const targetTemplate =
      projects.find((p) => p.id === targetProjectId)?.templateId ?? null;
    return todo.attributeValues
      .map((v) => attributes.find((a) => a.id === v.attributeId))
      .filter(
        (a): a is AttributeDefinition =>
          !!a && a.scope === "project" && a.templateId !== targetTemplate,
      )
      .map((a) => a.name)
      .join(", ");
  };

  const stepText =
    todo.position != null && total > 0
      ? nl.tasks.stepCount(todo.position, total)
      : null;

  return (
    <div ref={sectionRef} style={{ ...section, position: "relative" }}>
      <SectionLabel>{nl.tasks.projectLabel}</SectionLabel>
      <button
        type="button"
        onClick={() => setMoveOpen((x) => !x)}
        style={{
          ...valueBtn,
          display: "flex",
          flexDirection: "column",
          gap: 3,
          alignItems: "flex-start",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontWeight: "var(--weight-black)",
          }}
        >
          <span
            style={{
              width: "var(--dot-size)",
              height: "var(--dot-size)",
              borderRadius: "var(--radius-round)",
              background: project?.color ?? "var(--project-none)",
              flex: "none",
            }}
          />
          {project ? project.name : nl.tasks.noProject}
        </span>
        {stepText ? (
          <span
            style={{
              fontSize: "var(--text-base)",
              fontWeight: "var(--weight-bold)",
              color: "var(--text-muted)",
            }}
          >
            {stepText}
          </span>
        ) : null}
      </button>
      {moveOpen ? (
        <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 40 }}>
          <MoveProjectPopover
            projects={projects}
            currentProjectId={todo.projectId}
            onClose={() => setMoveOpen(false)}
            onPick={async (target) => {
              const names = clearedNamesFor(target);
              if (names && !window.confirm(nl.tasks.moveClearWarning(names))) return;
              setMoveOpen(false);
              await run(
                m.move.mutateAsync({ todoId: todo.id, targetProjectId: target }),
              );
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function LinksSection({
  todo,
  run,
  m,
}: {
  todo: Todo;
  run: (p: Promise<unknown>) => Promise<void>;
  m: ReturnType<typeof useTodoMutations>;
}) {
  const [dialog, setDialog] = useState<
    { mode: "new" } | { mode: "edit"; link: TodoLink } | null
  >(null);
  const openLink = (u: string) => {
    const isUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(u) || u.startsWith("mailto:");
    void (isUrl ? openUrl(u) : openPath(u)).catch(() => {});
  };
  return (
    <div style={section}>
      <SectionLabel>{nl.tasks.linksLabel}</SectionLabel>
      {todo.links.map((l) => (
        <div
          key={l.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            width: "100%",
          }}
        >
          <button
            type="button"
            onClick={() => openLink(l.url)}
            style={{
              ...linkBtn,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              flex: 1,
              minWidth: 0,
              textAlign: "left",
            }}
          >
            <Icon name="arrow-up-right" size={13} />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {l.title || l.url}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setDialog({ mode: "edit", link: l })}
            style={linkBtn}
          >
            {nl.beheer.edit}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setDialog({ mode: "new" })}
        style={secondaryBtn}
      >
        <Icon name="plus" size={13} />
        {nl.tasks.linkAddTitle}
      </button>

      {dialog ? (
        <LinkDialog
          initial={dialog.mode === "edit" ? dialog.link : undefined}
          onCancel={() => setDialog(null)}
          onSave={async (url, title) => {
            if (dialog.mode === "edit") {
              await run(
                m.updateLink.mutateAsync({ linkId: dialog.link.id, url, title }),
              );
            } else {
              await run(m.addLink.mutateAsync({ todoId: todo.id, url, title }));
            }
            setDialog(null);
          }}
          onDelete={
            dialog.mode === "edit"
              ? async () => {
                  await run(m.removeLink.mutateAsync({ linkId: dialog.link.id }));
                  setDialog(null);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function LinkDialog({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: TodoLink;
  onSave: (url: string, title: string | null) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [url, setUrl] = useState(initial?.url ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  return (
    <Dialog
      title={initial ? nl.tasks.linkEditTitle : nl.tasks.linkAddTitle}
      confirmLabel={initial ? nl.beheer.save : nl.beheer.add}
      confirmDisabled={!url.trim()}
      onConfirm={() => url.trim() && onSave(url.trim(), title.trim() || null)}
      onCancel={onCancel}
      note={
        onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            style={{ ...linkBtn, color: "var(--late-fg)" }}
          >
            {nl.beheer.delete}
          </button>
        ) : undefined
      }
    >
      <label style={fieldCol}>
        <span style={fieldCaption}>{nl.tasks.linkUrlCaption}</span>
        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={nl.tasks.linkUrlPlaceholder}
          style={editInput}
        />
      </label>
      <label style={fieldCol}>
        <span style={fieldCaption}>{nl.tasks.linkTitleCaption}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={editInput}
        />
      </label>
    </Dialog>
  );
}

/** Derived toestand (spec §6.3) + het opgeloste vuurmoment per herinneringrij. */
function ReminderStatusLine({ reminder }: { reminder: ReminderDefinition }) {
  const state = reminder.state ?? null;
  const meta = state ? nl.reminderStates[state] : null;
  const when = reminder.fireAt ?? reminder.fireAtLiteral ?? null;
  const whenText = when
    ? formatShortDateTime(new Date(when.replace(" ", "T")))
    : reminder.mode === "relative" && reminder.basis === "status"
      ? nl.reminderStates.waiting.hint
      : nl.tasks.perProjectReminder;
  const tone =
    state === "late"
      ? "late"
      : state === "pending" || state === "fired"
        ? "today"
        : state === "done" || state === "seen"
          ? "done"
          : "neutral";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
      {meta ? <MetaChip tone={tone}>{meta.label}</MetaChip> : null}
      <span style={hint}>{whenText}</span>
    </div>
  );
}

function RemindersSection({
  todo,
  statuses,
  run,
  m,
}: {
  todo: Todo;
  statuses: Status[];
  run: (p: Promise<unknown>) => Promise<void>;
  m: ReturnType<typeof useTodoMutations>;
}) {
  const [editor, setEditor] = useState<
    { mode: "new" } | { mode: "edit"; def: ReminderDefinition } | null
  >(null);
  return (
    <div style={section}>
      <SectionLabel>{nl.tasks.remindersLabel}</SectionLabel>
      {todo.reminders.map((r, i) => (
        <div
          key={r.id ?? i}
          style={{ display: "flex", flexDirection: "column", gap: 3, width: "100%" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
            <span
              style={{
                flex: 1,
                fontSize: "var(--text-base)",
                fontWeight: "var(--weight-bold)",
              }}
            >
              {reminderSummary(r)}
            </span>
            <button
              type="button"
              onClick={() => setEditor({ mode: "edit", def: r })}
              style={linkBtn}
            >
              {nl.beheer.edit}
            </button>
            {r.id != null ? (
              <button
                type="button"
                onClick={() => run(m.removeReminder.mutateAsync(r.id as number))}
                style={{ ...linkBtn, color: "var(--late-fg)" }}
              >
                {nl.beheer.delete}
              </button>
            ) : null}
          </div>
          <ReminderStatusLine reminder={r} />
        </div>
      ))}
      <button
        type="button"
        onClick={() => setEditor({ mode: "new" })}
        style={secondaryBtn}
      >
        {nl.tasks.addReminder}
      </button>

      {editor ? (
        <div role="presentation" onClick={() => setEditor(null)} style={overlay}>
          <div onClick={(e) => e.stopPropagation()}>
            <ReminderPopover
              statuses={statuses}
              allowSiblings={todo.projectId != null}
              context="task"
              initial={editor.mode === "edit" ? editor.def : undefined}
              submitLabel={editor.mode === "edit" ? nl.beheer.save : nl.beheer.add}
              onCancel={() => setEditor(null)}
              onSubmit={(def) => {
                if (editor.mode === "edit" && editor.def.id != null) {
                  void run(
                    m.updateReminder.mutateAsync({
                      id: editor.def.id,
                      definition: def,
                    }),
                  );
                } else {
                  void run(
                    m.addReminder.mutateAsync({ todoId: todo.id, definition: def }),
                  );
                }
                setEditor(null);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BottomBar({
  todo,
  run,
  m,
  onDeleted,
  onOpenOther,
}: {
  todo: Todo;
  run: (p: Promise<unknown>) => Promise<void>;
  m: ReturnType<typeof useTodoMutations>;
  onDeleted: () => void;
  onOpenOther: (id: number) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-4)",
        borderTop: "var(--border-width) solid var(--border-subtle)",
        paddingTop: "var(--space-6)",
      }}
    >
      <button
        type="button"
        onClick={async () => {
          const copy = await m.duplicate.mutateAsync(todo.id);
          onOpenOther(copy.id);
        }}
        style={secondaryBtn}
      >
        {nl.tasks.duplicate}
      </button>
      <DangerLink label={nl.tasks.delete} onClick={() => setDeleting(true)} />

      {deleting ? (
        <Dialog
          title={nl.tasks.deleteTitle(todo.title)}
          description={nl.tasks.deleteBody}
          confirmLabel={nl.tasks.deleteVerb}
          confirmVariant="danger"
          onConfirm={async () => {
            await run(m.remove.mutateAsync(todo.id));
            setDeleting(false);
            onDeleted();
          }}
          onCancel={() => setDeleting(false)}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- primitives

function ErrorBand({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-4)",
        background: "var(--late-bg)",
        border: "var(--border-width) solid var(--late-border)",
        borderRadius: "var(--radius)",
        padding: "9px 13px",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--weight-bold)",
        color: "var(--late-fg)",
      }}
    >
      <Icon name="circle-alert" size={14} />
      {text}
    </div>
  );
}

// ---------------------------------------------------------------- styles

const shell: CSSProperties = {
  width: "var(--detail-panel-w)",
  flex: "none",
  background: "var(--surface-panel)",
  borderLeft: "var(--border-width) solid var(--border-default)",
  display: "flex",
  flexDirection: "column",
  overflow: "auto",
};
const header: CSSProperties = {
  padding: "16px 20px",
  borderBottom: "var(--border-width) solid var(--border-default)",
  display: "flex",
  flexDirection: "column",
  gap: "9px",
};
const topRow: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--space-4)",
};
const body: CSSProperties = {
  padding: "16px 20px",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-9)",
};
const section: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
  alignItems: "flex-start",
};
const titleWrap: CSSProperties = {
  margin: 0,
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--space-3)",
  fontSize: "var(--text-lg)",
  fontWeight: "var(--weight-black)",
  lineHeight: "var(--leading-snug)",
};
const titleEditBtn: CSSProperties = {
  border: 0,
  background: "transparent",
  padding: 2,
  marginTop: 1,
  color: "var(--text-muted)",
  cursor: "pointer",
  flex: "none",
  display: "inline-flex",
};
const markDoneBtn: CSSProperties = {
  width: 32,
  height: 32,
  flex: "none",
  border: 0,
  borderRadius: "var(--radius)",
  background: "var(--accent)",
  color: "var(--text-on-dark)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
const menu: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  zIndex: 40,
  minWidth: 216,
  background: "var(--surface-card)",
  border: "var(--border-width) solid var(--border-window)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-popover)",
  padding: 6,
  display: "flex",
  flexDirection: "column",
};
const menuItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-4)",
  width: "100%",
  border: 0,
  background: "transparent",
  borderRadius: "var(--radius-sm)",
  padding: "8px 10px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-body)",
  cursor: "pointer",
  textAlign: "left",
};
const attrRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(90px, 30%) 1fr",
  gap: "9px 14px",
  alignItems: "start",
  width: "100%",
};
const attrLabel: CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: "var(--weight-semibold)",
  color: "var(--text-muted)",
  paddingTop: 6,
};
const fieldCol: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
};
const fieldCaption: CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-secondary)",
};
const editInput: CSSProperties = {
  minHeight: 34,
  border: "var(--border-width) solid var(--border-hover)",
  outline: "none",
  borderRadius: 8,
  padding: "0 10px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-body)",
  background: "var(--surface-card)",
  width: "100%",
};
const valueBtn: CSSProperties = {
  border: "1px solid transparent",
  background: "transparent",
  borderRadius: 8,
  padding: "6px 8px",
  margin: "-6px -8px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-body)",
  cursor: "text",
  textAlign: "left",
  width: "fit-content",
  maxWidth: "100%",
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
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
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
const hint: CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: "var(--weight-semibold)",
  color: "var(--text-muted)",
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
