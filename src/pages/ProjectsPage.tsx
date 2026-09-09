import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { nl } from "@/i18n";
import { isAppError } from "@/lib/ipc";
import type { Project, ProjectState } from "@/lib/taskTypes";
import { PROJECT_COLORS } from "@/lib/taskTypes";
import { useTemplates } from "@/lib/beheerQueries";
import {
  useProject,
  useProjectMutations,
  useProjects,
  useTodos,
} from "@/lib/taskQueries";
import {
  BeheerColumns,
  BeheerHeader,
  BeheerLayout,
  ListCard,
} from "@/components/beheer/Scaffold";
import { OnboardingEmptyState } from "@/components/onboarding/OnboardingEmptyState";
import { useOnboarding } from "@/lib/dashboardQueries";
import { Modal } from "@/components/overlays/Modal";
import { Dialog } from "@/components/overlays/Dialog";
import { Icon } from "@/components/core/Icon";
import { SectionLabel } from "@/components/display/SectionLabel";
import { ProgressBar } from "@/components/display/ProgressBar";
import { TaskListView } from "@/components/tasks/TaskListView";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { AddTaskModal } from "@/components/tasks/AddTaskModal";

const ALL_STATES: { key: ProjectState; label: string }[] = [
  { key: "active", label: nl.projects.filterActive },
  { key: "completed", label: nl.projects.filterCompleted },
  { key: "archived", label: nl.projects.filterArchived },
];

export function ProjectsPage({ navSignal = 0 }: { navSignal?: number }) {
  const [openProjectId, setOpenProjectId] = useState<number | null>(null);

  // Sidebar click on "Projecten" always returns to the overview.
  useEffect(() => setOpenProjectId(null), [navSignal]);

  if (openProjectId != null) {
    return (
      <ProjectTasksView
        key={openProjectId}
        projectId={openProjectId}
        onBack={() => setOpenProjectId(null)}
        onOpenProject={setOpenProjectId}
      />
    );
  }
  return <ProjectOverview onOpen={setOpenProjectId} />;
}

// ---------------------------------------------------------------- overview

function ProjectOverview({ onOpen }: { onOpen: (id: number) => void }) {
  // Eigen projectfilters, buiten de gedeelde filterstatus.
  const [filter, setFilter] = useState<Set<ProjectState>>(new Set(["active"]));
  const stateFilter = useMemo(() => [...filter], [filter]);
  const { data: projects = [], isLoading, isError } = useProjects(stateFilter);
  const { data: onboarding } = useOnboarding();
  const [creating, setCreating] = useState(false);

  const toggle = (s: ProjectState) =>
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next.size === 0 ? new Set<ProjectState>(["active"]) : next;
    });

  return (
    <BeheerLayout>
      <BeheerHeader
        title={nl.projects.title}
        count={nl.projects.count(projects.length)}
        intro={nl.projects.intro}
        primaryLabel={nl.projects.newProject}
        onPrimary={() => setCreating(true)}
      />
      <BeheerColumns>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          {ALL_STATES.map((s) => {
            const active = filter.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(s.key)}
                style={{
                  height: "var(--control-h-sm)",
                  padding: "0 var(--control-pad-x-sm)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-base)",
                  fontWeight: "var(--weight-bold)",
                  borderRadius: "var(--radius)",
                  cursor: "pointer",
                  border: active
                    ? "var(--border-width) solid var(--accent-tint-border)"
                    : "var(--border-width) solid var(--border-default)",
                  background: active ? "var(--accent-tint)" : "var(--surface-card)",
                  color: active ? "var(--accent-text)" : "var(--text-body)",
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <p style={muted}>{nl.beheer.loading}</p>
        ) : isError ? (
          <p style={muted}>{nl.beheer.loadError}</p>
        ) : projects.length === 0 && onboarding && !onboarding.hasProject ? (
          <OnboardingEmptyState
            step={2}
            title={nl.onboarding.projects.title}
            body={nl.onboarding.projects.body}
            actionLabel={nl.onboarding.projects.action}
            onAction={() => setCreating(true)}
            hint={nl.onboarding.projects.hint}
          />
        ) : projects.length === 0 ? (
          <p style={muted}>
            {filter.size === 1 && filter.has("active")
              ? nl.projects.emptyActive
              : nl.projects.emptyFiltered}
          </p>
        ) : (
          <ListCard>
            {projects.map((p, i) => (
              <ProjectRow
                key={p.id}
                project={p}
                divider={i < projects.length - 1}
                onOpen={() => onOpen(p.id)}
              />
            ))}
          </ListCard>
        )}
      </BeheerColumns>

      {creating ? (
        <CreateProjectModal onClose={() => setCreating(false)} onCreated={onOpen} />
      ) : null}
    </BeheerLayout>
  );
}

function ProjectRow({
  project,
  divider,
  onOpen,
}: {
  project: Project;
  divider: boolean;
  onOpen: () => void;
}) {
  const pct = project.todoCount > 0 ? (project.doneCount / project.todoCount) * 100 : 0;
  const stateLabel =
    project.state === "completed"
      ? nl.projects.stateCompleted
      : project.state === "archived"
        ? nl.projects.stateArchived
        : nl.projects.stateActive;
  return (
    <div
      onClick={onOpen}
      style={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0,1fr) 120px auto 30px",
        gap: "var(--space-6)",
        alignItems: "center",
        padding: "14px 18px",
        borderBottom: divider
          ? "var(--border-width) solid var(--border-subtle)"
          : "none",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          width: "var(--dot-size-lg)",
          height: "var(--dot-size-lg)",
          borderRadius: "var(--radius-round)",
          background: project.color,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <span
          style={{
            fontSize: "var(--text-lg)",
            fontWeight: "var(--weight-black)",
            letterSpacing: "-0.2px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {project.name}
        </span>
        <span
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: "var(--weight-bold)",
            color: "var(--text-muted)",
          }}
        >
          {project.templateName
            ? nl.projects.fromTemplate(project.templateName)
            : nl.projects.looseProject}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        <ProgressBar value={pct} width="full" />
      </div>
      <span
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: "var(--weight-bold)",
          color: "var(--text-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {project.todoCount === 0
          ? nl.projects.noTasks
          : `${nl.projects.progress(project.doneCount, project.todoCount)} · ${stateLabel}`}
      </span>
      <Icon name="chevron-right" size={16} style={{ color: "var(--text-muted)" }} />
    </div>
  );
}

// ---------------------------------------------------------- create dialog

export function CreateProjectModal({
  onClose,
  onCreated,
  initialTemplateId = null,
  lockTemplate = false,
}: {
  onClose: () => void;
  onCreated: (id: number) => void;
  /** Preselect a sjabloon to start from. */
  initialTemplateId?: number | null;
  /** Hide the "Starten met" keuze — the sjabloon is fixed by the caller. */
  lockTemplate?: boolean;
}) {
  const { data: templates = [] } = useTemplates();
  const m = useProjectMutations();
  const [templateId, setTemplateId] = useState<number | null>(initialTemplateId);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim()) return;
    setError(null);
    try {
      const created = await m.create.mutateAsync({
        name: name.trim(),
        color,
        templateId,
      });
      onClose();
      onCreated(created.id);
    } catch (e) {
      setError(isAppError(e) ? e.message : nl.beheer.loadError);
    }
  };

  return (
    <Modal
      title={nl.projects.createTitle}
      description={nl.projects.intro}
      width={560}
      confirmLabel={nl.projects.newProject}
      confirmDisabled={!name.trim() || m.create.isPending}
      onConfirm={create}
      onClose={onClose}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {lockTemplate ? null : (
          <label
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
          >
            <SectionLabel>{nl.projects.createFromLabel}</SectionLabel>
            <select
              value={templateId ?? ""}
              onChange={(e) =>
                setTemplateId(e.target.value ? Number(e.target.value) : null)
              }
              style={textInput}
            >
              <option value="">{nl.projects.createEmpty}</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
        >
          <SectionLabel>{nl.projects.nameLabel}</SectionLabel>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void create())}
            placeholder={nl.projects.namePlaceholder}
            style={textInput}
          />
        </label>

        <div
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
        >
          <SectionLabel>{nl.projects.colorLabel}</SectionLabel>
          <ColorRamp value={color} onChange={setColor} />
        </div>

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
      </div>
    </Modal>
  );
}

function ColorRamp({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(8, 30px)",
        gap: "var(--space-4)",
      }}
    >
      {PROJECT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          style={{
            width: 30,
            height: 30,
            borderRadius: "var(--radius-round)",
            background: c,
            border: value === c ? "3px solid var(--accent)" : "3px solid transparent",
            cursor: "pointer",
          }}
        />
      ))}
    </div>
  );
}

// ------------------------------------------------------ project task view

function ProjectTasksView({
  projectId,
  onBack,
  onOpenProject,
}: {
  projectId: number;
  onBack: () => void;
  /** Navigeer naar een ander project (bv. de zojuist gemaakte kopie). */
  onOpenProject: (id: number) => void;
}) {
  const { data: project } = useProject(projectId);
  const { data: todos = [] } = useTodos({ projectId, includeArchived: true });
  const m = useProjectMutations();

  const [openTodoId, setOpenTodoId] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [dialog, setDialog] = useState<
    "duplicate" | "markCompleted" | "archive" | "unarchive" | "delete" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const run = async <T,>(p: Promise<T>, after?: (value: T) => void) => {
    setError(null);
    try {
      const value = await p;
      after?.(value);
    } catch (e) {
      setError(isAppError(e) ? e.message : nl.beheer.loadError);
    }
  };

  if (!project) {
    return (
      <BeheerLayout>
        <p style={{ padding: "var(--space-9) var(--gutter)", ...muted }}>
          {nl.beheer.loading}
        </p>
      </BeheerLayout>
    );
  }

  const stillOpen = project.todoCount - project.doneCount;
  const archived = project.state === "archived";

  const menuItems: { label: string; danger?: boolean; onClick: () => void }[] = [
    {
      label: nl.projects.menuRename,
      onClick: () => {
        setRenaming(true);
        setMenuOpen(false);
      },
    },
    {
      label: nl.projects.menuDuplicate,
      onClick: () => {
        setDialog("duplicate");
        setMenuOpen(false);
      },
    },
    {
      label: nl.projects.menuAddTask,
      onClick: () => {
        setAdding(true);
        setMenuOpen(false);
      },
    },
    {
      label: nl.projects.menuMarkCompleted,
      onClick: () => {
        setDialog("markCompleted");
        setMenuOpen(false);
      },
    },
    archived
      ? {
          label: nl.projects.menuUnarchive,
          onClick: () => {
            setDialog("unarchive");
            setMenuOpen(false);
          },
        }
      : {
          label: nl.projects.menuArchive,
          onClick: () => {
            setDialog("archive");
            setMenuOpen(false);
          },
        },
    {
      label: nl.projects.menuDelete,
      danger: true,
      onClick: () => {
        setDialog("delete");
        setMenuOpen(false);
      },
    },
  ];

  const pct = project.todoCount > 0 ? (project.doneCount / project.todoCount) * 100 : 0;

  return (
    <BeheerLayout>
      <header
        style={{
          flex: "none",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
          padding: "var(--space-7) var(--gutter) var(--space-6)",
          borderBottom: "var(--border-width) solid var(--border-default)",
        }}
      >
        <button type="button" onClick={onBack} style={backBtn}>
          <span style={{ transform: "scaleX(-1)", display: "flex" }}>
            <Icon name="chevron-right" size={13} />
          </span>
          {nl.projects.back}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
          <span
            style={{
              width: "var(--dot-size-lg)",
              height: "var(--dot-size-lg)",
              borderRadius: "var(--radius-round)",
              background: project.color,
            }}
          />
          <h1
            style={{
              margin: 0,
              fontSize: "var(--text-3xl)",
              fontWeight: "var(--weight-black)",
              letterSpacing: "var(--tracking-title)",
            }}
          >
            {project.name}
          </h1>
          <span
            style={{
              fontSize: "var(--text-md)",
              fontWeight: "var(--weight-bold)",
              color: "var(--text-muted)",
            }}
          >
            {project.todoCount === 0
              ? nl.projects.noTasks
              : nl.projects.progress(project.doneCount, project.todoCount)}
            {" · "}
            {project.state === "completed"
              ? nl.projects.stateCompleted
              : archived
                ? nl.projects.stateArchived
                : nl.projects.stateActive}
          </span>
          <div style={{ flex: 1 }} />
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setMenuOpen((x) => !x)}
              style={ellipsisBtn}
              aria-label="Projectacties"
            >
              <Icon name="ellipsis" size={18} />
            </button>
            {menuOpen ? (
              <div style={menu} role="menu">
                {menuItems.map((it) => (
                  <button
                    key={it.label}
                    type="button"
                    role="menuitem"
                    onClick={it.onClick}
                    style={{
                      ...menuItem,
                      color: it.danger ? "var(--late-fg)" : "var(--text-body)",
                    }}
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <ProgressBar value={pct} width="full" />
      </header>

      <BeheerColumns
        panel={
          openTodoId != null ? (
            <TaskDetailPanel
              key={openTodoId}
              todoId={openTodoId}
              onClose={() => setOpenTodoId(null)}
              onDeleted={() => setOpenTodoId(null)}
              onOpenOther={setOpenTodoId}
            />
          ) : undefined
        }
      >
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
        <div>
          <button type="button" onClick={() => setAdding(true)} style={addBtn}>
            <Icon name="plus" size={14} /> {nl.projects.menuAddTask}
          </button>
        </div>
        <TaskListView
          todos={todos}
          openId={openTodoId}
          onOpen={setOpenTodoId}
          emptyMessage={nl.tasks.emptyList}
        />
      </BeheerColumns>

      {adding ? (
        <AddTaskModal
          defaultProjectId={projectId}
          onClose={() => setAdding(false)}
          onCreated={(t) => setOpenTodoId(t.id)}
        />
      ) : null}

      {renaming ? (
        <RenameProjectModal
          project={project}
          onClose={() => setRenaming(false)}
          onSave={(name, color) =>
            run(m.update.mutateAsync({ id: projectId, name, color }), () =>
              setRenaming(false),
            )
          }
        />
      ) : null}

      {dialog === "duplicate" ? (
        <Dialog
          title={nl.projects.duplicateTitle(project.name)}
          description={nl.projects.duplicateBody}
          confirmLabel={nl.projects.duplicateVerb}
          onConfirm={() =>
            run(m.duplicate.mutateAsync(projectId), (created) => {
              setDialog(null);
              onOpenProject(created.id);
            })
          }
          onCancel={() => setDialog(null)}
        />
      ) : null}

      {dialog === "markCompleted" ? (
        <Dialog
          title={nl.projects.markCompletedTitle(project.name)}
          description={nl.projects.markCompletedBody}
          confirmLabel={nl.projects.markCompletedVerb}
          onConfirm={() =>
            run(m.markCompleted.mutateAsync(projectId), () => setDialog(null))
          }
          onCancel={() => setDialog(null)}
        />
      ) : null}

      {dialog === "archive" ? (
        <Dialog
          title={nl.projects.archiveTitle(project.name)}
          description={nl.projects.archiveBody}
          warning={
            stillOpen > 0 ? nl.projects.archiveOpenTasksWarning(stillOpen) : undefined
          }
          confirmLabel={nl.projects.archiveVerb}
          onConfirm={() => run(m.archive.mutateAsync(projectId), () => setDialog(null))}
          onCancel={() => setDialog(null)}
        />
      ) : null}

      {dialog === "unarchive" ? (
        <Dialog
          title={nl.projects.unarchiveTitle(project.name)}
          description={nl.projects.unarchiveBody}
          confirmLabel={nl.projects.unarchiveVerb}
          onConfirm={() =>
            run(m.unarchive.mutateAsync(projectId), () => setDialog(null))
          }
          onCancel={() => setDialog(null)}
        />
      ) : null}

      {dialog === "delete" ? (
        <DeleteProjectDialog
          project={project}
          onCancel={() => setDialog(null)}
          onConfirm={(typedName) =>
            run(m.remove.mutateAsync({ id: projectId, typedName }), () => {
              setDialog(null);
              onBack();
            })
          }
        />
      ) : null}
    </BeheerLayout>
  );
}

function RenameProjectModal({
  project,
  onClose,
  onSave,
}: {
  project: Project;
  onClose: () => void;
  onSave: (name: string, color: string) => void;
}) {
  const [name, setName] = useState(project.name);
  const [color, setColor] = useState(project.color);
  return (
    <Modal
      title={nl.projects.renameTitle}
      width={520}
      confirmLabel={nl.beheer.save}
      confirmDisabled={!name.trim()}
      onConfirm={() => onSave(name.trim(), color)}
      onClose={onClose}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <label
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
        >
          <SectionLabel>{nl.projects.nameLabel}</SectionLabel>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={textInput}
          />
        </label>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
        >
          <SectionLabel>{nl.projects.colorLabel}</SectionLabel>
          <ColorRamp value={color} onChange={setColor} />
        </div>
      </div>
    </Modal>
  );
}

export function DeleteProjectDialog({
  project,
  onCancel,
  onConfirm,
}: {
  project: Project;
  onCancel: () => void;
  onConfirm: (typedName: string) => void;
}) {
  const [typed, setTyped] = useState("");
  return (
    <Dialog
      title={nl.projects.deleteTitle(project.name)}
      description={nl.projects.deleteBody}
      warning={nl.projects.deleteArchiveInstead}
      confirmLabel={nl.projects.deleteVerb}
      confirmVariant="danger"
      confirmDisabled={typed.trim() !== project.name}
      onConfirm={() => onConfirm(typed.trim())}
      onCancel={onCancel}
    >
      <label
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
      >
        <SectionLabel>{nl.projects.deleteTypeNameLabel}</SectionLabel>
        <span
          style={{
            alignSelf: "flex-start",
            maxWidth: "100%",
            padding: "4px 9px",
            borderRadius: "var(--radius-sm)",
            background: "var(--surface-sunken)",
            border: "var(--border-width) solid var(--border-subtle)",
            fontSize: "var(--text-md)",
            fontWeight: "var(--weight-black)",
            color: "var(--text-body)",
            userSelect: "all",
            overflowWrap: "anywhere",
          }}
        >
          {project.name}
        </span>
        <input
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          style={textInput}
        />
      </label>
    </Dialog>
  );
}

// ---------------------------------------------------------------- styles

const muted: CSSProperties = {
  margin: 0,
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-medium)",
  color: "var(--text-secondary)",
};
const textInput: CSSProperties = {
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
const backBtn: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  border: 0,
  background: "transparent",
  color: "var(--text-link)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-sm)",
  fontWeight: "var(--weight-bold)",
  cursor: "pointer",
  width: "fit-content",
  padding: 0,
};
const ellipsisBtn: CSSProperties = {
  height: 32,
  width: 32,
  border: "var(--border-width) solid var(--border-default)",
  background: "var(--surface-card)",
  borderRadius: "var(--radius)",
  color: "var(--text-secondary)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
const menu: CSSProperties = {
  position: "absolute",
  top: "100%",
  right: 0,
  marginTop: 4,
  minWidth: 220,
  background: "var(--surface-card)",
  border: "var(--border-width) solid var(--border-window)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-popover)",
  padding: 5,
  zIndex: 40,
  display: "flex",
  flexDirection: "column",
};
const menuItem: CSSProperties = {
  border: 0,
  background: "transparent",
  borderRadius: "var(--radius-sm)",
  padding: "9px 11px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-bold)",
  textAlign: "left",
  cursor: "pointer",
};
const addBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--space-4)",
  height: "var(--control-h-sm)",
  padding: "0 var(--control-pad-x-sm)",
  border: "var(--border-width) solid var(--border-default)",
  background: "var(--surface-card)",
  borderRadius: "var(--radius)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-base)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-body)",
  cursor: "pointer",
};
