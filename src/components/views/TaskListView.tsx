import { useMemo, type CSSProperties } from "react";
import { nl } from "@/i18n";
import type { Todo } from "@/lib/taskTypes";
import type { Status } from "@/lib/statusTypes";
import type { Project } from "@/lib/taskTypes";
import { useStatuses } from "@/lib/beheerQueries";
import { useProjects, useTodoMutations } from "@/lib/taskQueries";
import { statusTone, deadlineChip } from "@/lib/taskDisplay";
import { useViewState } from "@/store/useViewState";
import { useViewPrefs } from "@/lib/viewQueries";
import { Checkbox } from "@/components/core/Checkbox";
import { MetaChip } from "@/components/display/MetaChip";
import { ProgressBar } from "@/components/display/ProgressBar";
import { Dot } from "@/components/display/Dot";
import { RowStatusMenu } from "@/components/tasks/RowStatusMenu";
import { ListCard } from "@/components/beheer/Scaffold";

/**
 * Lijst-view (spec §8). Gegroepeerd per project of per status — de groepeerkeuze
 * is **view-lokaal** (persistent via `user_settings`) en kent ook "geen
 * groepering". Rij openen → taakdetailpaneel; de status-pill in de rij opent een
 * keuzelijst met alle statussen (schrijft `todo_status_event` → recalc).
 * Truncatie i.p.v. wrappen.
 */
export function TaskListView({
  todos,
  openId,
  onOpen,
}: {
  todos: Todo[];
  openId: number | null;
  onOpen: (id: number) => void;
}) {
  const { data: statuses = [] } = useStatuses();
  const { data: projects = [] } = useProjects(["active", "completed", "archived"]);
  const m = useTodoMutations();
  const selection = useViewState((s) => s.selection);
  const toggleSelected = useViewState((s) => s.toggleSelected);
  const { prefs } = useViewPrefs("list");
  const group = prefs.group ?? "project";
  const sortPref = prefs.sort ?? null;

  const orderedStatuses = useMemo(
    () => [...statuses].sort((a, b) => a.position - b.position),
    [statuses],
  );
  const statusById = useMemo(() => {
    const map = new Map<number, Status>();
    statuses.forEach((s) => map.set(s.id, s));
    return map;
  }, [statuses]);
  const projectById = useMemo(() => {
    const map = new Map<number, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);
  const doneStatusId = statuses.find((s) => s.isDone)?.id ?? -1;

  const sorted = useMemo(() => {
    if (!sortPref) return todos;
    const dir = sortPref.desc ? -1 : 1;
    const key = (t: Todo) => {
      switch (sortPref.id) {
        case "title":
          return t.title.toLocaleLowerCase("nl");
        case "deadline":
          return t.deadlineDate ?? "9999-12-31";
        case "created":
          return t.createdAt;
        default:
          return String(t.position ?? 0).padStart(6, "0");
      }
    };
    return [...todos].sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      return ka < kb ? -dir : ka > kb ? dir : 0;
    });
  }, [todos, sortPref]);

  const groups = useMemo(() => {
    if (group === "none") {
      return [
        { key: "all", title: "", dotColor: null as string | null, todos: sorted },
      ];
    }
    if (group === "status") {
      const byStatus = new Map<string, Todo[]>();
      for (const t of sorted) {
        const key = String(t.statusId);
        if (!byStatus.has(key)) byStatus.set(key, []);
        byStatus.get(key)!.push(t);
      }
      const known = orderedStatuses
        .filter((s) => byStatus.has(String(s.id)))
        .map((s) => ({
          key: `status-${s.id}`,
          title: s.name,
          dotColor: s.color,
          todos: byStatus.get(String(s.id))!,
        }));
      const orphans = [...byStatus.entries()]
        .filter(([key]) => !statusById.has(Number(key)))
        .map(([key, list]) => ({
          key: `status-${key}`,
          title: "?",
          dotColor: null as string | null,
          todos: list,
        }));
      return [...known, ...orphans];
    }
    const byProject = new Map<string, { project: Project | null; todos: Todo[] }>();
    for (const t of sorted) {
      const key = t.projectId == null ? "loose" : String(t.projectId);
      if (!byProject.has(key)) {
        byProject.set(key, {
          project: t.projectId == null ? null : (projectById.get(t.projectId) ?? null),
          todos: [],
        });
      }
      byProject.get(key)!.todos.push(t);
    }
    return [...byProject.entries()].map(([key, v]) => ({
      key,
      title: v.project ? v.project.name : nl.tasks.loose,
      dotColor: (v.project?.color ?? null) as string | null,
      todos: v.todos,
    }));
  }, [group, sorted, orderedStatuses, statusById, projectById]);

  const setStatus = (todoId: number, statusId: number) => {
    void m.setStatus.mutateAsync({ todoId, statusId });
  };

  if (todos.length === 0) {
    return <p style={emptyText}>{nl.views.emptyFiltered}</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      {groups.map((g) => {
        const total = g.todos.length;
        const done = g.todos.filter((t) => t.statusId === doneStatusId).length;
        return (
          <section
            key={g.key}
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}
          >
            {group !== "none" ? (
              <div style={groupHeader}>
                {g.dotColor ? (
                  <span
                    style={{
                      width: "var(--dot-size-lg)",
                      height: "var(--dot-size-lg)",
                      borderRadius: "var(--radius-round)",
                      flex: "none",
                      background: g.dotColor,
                    }}
                  />
                ) : (
                  <Dot project="none" size="lg" />
                )}
                <h2 style={groupTitle}>{g.title}</h2>
                {group === "project" ? (
                  <>
                    <span style={groupMeta}>{nl.views.groupProgress(done, total)}</span>
                    {total > 0 ? (
                      <ProgressBar
                        value={total ? Math.round((done / total) * 100) : 0}
                      />
                    ) : null}
                  </>
                ) : (
                  <span style={groupMeta}>{nl.views.groupCount(total)}</span>
                )}
              </div>
            ) : null}

            <ListCard>
              {g.todos.map((t, i) => {
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
                        i < g.todos.length - 1
                          ? "var(--border-width) solid var(--border-subtle)"
                          : "none",
                      background:
                        t.id === openId ? "var(--surface-row-selected)" : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <span onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selection.has(t.id)}
                        onChange={() => toggleSelected(t.id)}
                        label={nl.views.selectTask}
                      />
                    </span>
                    <span style={posCell}>{t.position ?? ""}</span>
                    <span style={titleCell}>{t.title}</span>
                    <div style={rowRight}>
                      {chip ? <MetaChip tone={chip.tone}>{chip.text}</MetaChip> : null}
                      <RowStatusMenu
                        statuses={orderedStatuses}
                        value={t.statusId}
                        tone={statusTone(status)}
                        label={status?.name ?? "?"}
                        color={status?.color}
                        onPick={(statusId) => setStatus(t.id, statusId)}
                      />
                    </div>
                  </div>
                );
              })}
            </ListCard>
          </section>
        );
      })}
    </div>
  );
}

const emptyText: CSSProperties = {
  margin: 0,
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-medium)",
  color: "var(--text-secondary)",
};
const groupHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "11px",
  padding: "0 var(--space-2)",
  flexWrap: "wrap",
};
const groupTitle: CSSProperties = {
  margin: 0,
  fontSize: "var(--text-xl)",
  fontWeight: "var(--weight-black)",
};
const groupMeta: CSSProperties = {
  fontSize: "var(--text-base)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-muted)",
};
const posCell: CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: "var(--weight-black)",
  color: "var(--text-muted)",
};
const titleCell: CSSProperties = {
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-bold)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const rowRight: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "var(--space-4)",
};
