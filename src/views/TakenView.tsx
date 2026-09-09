import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { nl } from "@/i18n";
import { useViewState, type TaskSubView, filterIsEmpty } from "@/store/useViewState";
import { TASK_SUBVIEWS } from "@/app/routes";
import { useFilteredTodos, useVisibleCounts } from "@/lib/viewQueries";
import { useStatuses } from "@/lib/beheerQueries";
import { useProjects } from "@/lib/taskQueries";
import { ViewHeader } from "./ViewHeader";
import { ViewControls, type ViewChip } from "./ViewControls";
import { FooterBar } from "./FooterBar";
import { Button } from "@/components/core/Button";
import { SearchInput } from "@/components/forms/SearchInput";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { AddTaskModal } from "@/components/tasks/AddTaskModal";
import { TaskListView } from "@/components/views/TaskListView";
import { TaskTable } from "@/components/views/TaskTable";
import { KanbanBoard } from "@/components/views/KanbanBoard";
import { FilterPanel } from "@/components/views/FilterPanel";
import { BulkBar } from "@/components/views/BulkBar";
import { CalendarView } from "@/components/views/CalendarView";
import { OnboardingEmptyState } from "@/components/onboarding/OnboardingEmptyState";
import { useOnboarding } from "@/lib/dashboardQueries";

import type { Todo } from "@/lib/taskTypes";
import type { Status } from "@/lib/statusTypes";
import type { Project } from "@/lib/taskTypes";

// Stable empties for still-loading queries (avoid churning memo/table deps).
const NO_TODOS: Todo[] = [];
const NO_STATUSES: Status[] = [];
const NO_PROJECTS: Project[] = [];

const SUBVIEW_LABEL: Record<TaskSubView, string> = {
  list: nl.taskViews.list,
  table: nl.taskViews.table,
  kanban: nl.taskViews.kanban,
  calendar: nl.taskViews.calendar,
};

/**
 * Taken destination — de view-shell. Draagt de view-tabs, de
 * `SearchInput`, de filter-pill/`FilterChip`-rij, de drie views (Lijst / Tabel /
 * Kanban), de gedeelde voetbalk en de bulkbalk. **Alleen de filter + zoekterm
 * zijn gedeeld** over de views; sortering/groepering/kolommen zijn view-lokaal.
 */
export function TakenView({
  sub,
  onSubView,
}: {
  sub: TaskSubView;
  onSubView: (v: TaskSubView) => void;
}) {
  const filter = useViewState((s) => s.filter);
  const patchFilter = useViewState((s) => s.patchFilter);
  const clearFilter = useViewState((s) => s.clearFilter);
  const search = useViewState((s) => s.search);
  const setSearch = useViewState((s) => s.setSearch);
  const filterPanelOpen = useViewState((s) => s.filterPanelOpen);
  const setFilterPanelOpen = useViewState((s) => s.setFilterPanelOpen);
  const selection = useViewState((s) => s.selection);
  const clearSelection = useViewState((s) => s.clearSelection);
  const pendingTodoId = useViewState((s) => s.pendingTodoId);
  const requestOpenTodo = useViewState((s) => s.requestOpenTodo);
  const pendingNewTask = useViewState((s) => s.pendingNewTask);
  const requestNewTask = useViewState((s) => s.requestNewTask);
  const { data: onboarding } = useOnboarding();

  const todosQuery = useFilteredTodos(filter, search);
  const todos = todosQuery.data ?? NO_TODOS;
  const { data: counts } = useVisibleCounts(filter, search);
  const statuses = useStatuses().data ?? NO_STATUSES;
  const projects = useProjects(["active", "completed", "archived"]).data ?? NO_PROJECTS;

  const [openId, setOpenId] = useState<number | null>(null);
  const [adding, setAdding] = useState<{ statusId: number | null } | null>(null);

  // Zoekterm met een kleine invoerrust (~200 ms, spec §8.2).
  const [rawSearch, setRawSearch] = useState(search);
  useEffect(() => {
    const id = window.setTimeout(() => setSearch(rawSearch), 200);
    return () => window.clearTimeout(id);
  }, [rawSearch, setSearch]);
  useEffect(() => {
    if (search !== rawSearch && search === "") setRawSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Een reminder-notificatie deep-link vroeg een taak te openen.
  useEffect(() => {
    if (pendingTodoId != null) {
      setOpenId(pendingTodoId);
      requestOpenTodo(null);
    }
  }, [pendingTodoId, requestOpenTodo]);

  // De Dashboard-knop "Nieuwe taak" vroeg het toevoegformulier te openen (§7).
  useEffect(() => {
    if (pendingNewTask) {
      setAdding({ statusId: null });
      requestNewTask(false);
    }
  }, [pendingNewTask, requestNewTask]);

  const rawChips = useFilterChips(filter, statuses, projects);
  const chips: ViewChip[] = rawChips.map((c) => ({
    key: c.key,
    label: c.label,
    remove: () => c.remove(patchFilter),
  }));
  const activeCount = chips.length;
  const compact = filterPanelOpen || openId != null;

  const openTask = (id: number) => {
    setFilterPanelOpen(false);
    setOpenId(id);
  };

  const scrollAreaStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    overflow: sub === "kanban" ? "hidden" : "auto",
    padding:
      sub === "kanban"
        ? "var(--space-8) var(--gutter)"
        : "var(--space-8) var(--gutter) var(--space-12)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-9)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <ViewHeader
        title={nl.nav.tasks}
        meta={
          counts ? (
            <span style={metaCount}>
              {nl.views.visibleShort(counts.visible, counts.total)}
            </span>
          ) : null
        }
        actions={
          <>
            <SearchInput
              placeholder={nl.views.searchPlaceholder}
              shortcut={null}
              value={rawSearch}
              onChange={setRawSearch}
            />
            <Button
              size="major"
              icon="plus"
              onClick={() => setAdding({ statusId: null })}
            >
              {nl.tasks.quickAddTitle}
            </Button>
          </>
        }
        toolbar={
          <>
            <nav style={tabRow} aria-label={nl.nav.tasks}>
              {TASK_SUBVIEWS.map((v) => {
                const active = v === sub;
                return (
                  <button
                    key={v}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => onSubView(v)}
                    style={{
                      ...tab,
                      borderBottomColor: active ? "var(--accent)" : "transparent",
                      color: active ? "var(--accent-text)" : "var(--text-secondary)",
                      fontWeight: active
                        ? "var(--weight-bold)"
                        : "var(--weight-semibold)",
                    }}
                  >
                    {SUBVIEW_LABEL[v]}
                  </button>
                );
              })}
            </nav>

            <ViewControls
              sub={sub}
              filterPanelOpen={filterPanelOpen}
              onToggleFilterPanel={() => setFilterPanelOpen(!filterPanelOpen)}
              activeFilterCount={activeCount}
              chips={chips}
            />
          </>
        }
      />

      <div style={{ display: "flex", minHeight: 0, flex: 1 }}>
        <div style={scrollAreaStyle}>
          {sub === "calendar" ? (
            <CalendarView onOpen={openTask} />
          ) : onboarding &&
            !onboarding.hasTodo &&
            filterIsEmpty(filter) &&
            search === "" ? (
            <OnboardingEmptyState
              step={3}
              title={nl.onboarding.tasks.title}
              body={nl.onboarding.tasks.body}
              actionLabel={nl.onboarding.tasks.action}
              onAction={() => setAdding({ statusId: null })}
              hint={nl.onboarding.tasks.hint}
            />
          ) : sub === "list" ? (
            <TaskListView todos={todos} openId={openId} onOpen={openTask} />
          ) : sub === "table" ? (
            <TaskTable todos={todos} onOpen={openTask} />
          ) : (
            <KanbanBoard
              todos={todos}
              onOpen={openTask}
              onQuickAdd={(statusId) => setAdding({ statusId })}
            />
          )}
        </div>

        {filterPanelOpen ? (
          <FilterPanel onClose={() => setFilterPanelOpen(false)} />
        ) : openId != null ? (
          <TaskDetailPanel
            key={openId}
            todoId={openId}
            onClose={() => setOpenId(null)}
            onDeleted={() => setOpenId(null)}
            onOpenOther={setOpenId}
          />
        ) : null}
      </div>

      {selection.size > 0 ? <BulkBar compact={compact} /> : null}

      <FooterBar
        shown={counts?.visible ?? 0}
        total={counts?.total ?? 0}
        late={counts?.late ?? 0}
        onClear={() => {
          clearFilter();
          setSearch("");
          setRawSearch("");
          clearSelection();
        }}
      />

      {adding ? (
        <AddTaskModal
          defaultStatusId={adding.statusId}
          onClose={() => setAdding(null)}
          onCreated={(t) => {
            setAdding(null);
            openTask(t.id);
          }}
        />
      ) : null}
    </div>
  );
}

// --- filterchips -----------------------------------------------------------

interface Chip {
  key: string;
  label: string;
  remove: (
    patch: (p: Partial<import("@/store/useViewState").TodoFilter>) => void,
  ) => void;
}

function useFilterChips(
  filter: import("@/store/useViewState").TodoFilter,
  statuses: { id: number; name: string }[],
  projects: { id: number; name: string }[],
): Chip[] {
  return useMemo(() => {
    const out: Chip[] = [];
    if (filter.statusIds.length) {
      const names = filter.statusIds
        .map((id) => statuses.find((s) => s.id === id)?.name ?? "?")
        .join(", ");
      out.push({
        key: "status",
        label: `${nl.views.filterGroupStatus}: ${names}`,
        remove: (patch) => patch({ statusIds: [] }),
      });
    }
    if (filter.projectIds.length) {
      const names = filter.projectIds
        .map((id) => projects.find((p) => p.id === id)?.name ?? "?")
        .join(", ");
      out.push({
        key: "project",
        label: `${nl.views.filterGroupProject}: ${names}`,
        remove: (patch) => patch({ projectIds: [] }),
      });
    }
    if (filter.deadline) {
      const label =
        {
          overdue: nl.views.deadlineOverdue,
          today: nl.views.deadlineToday,
          thisWeek: nl.views.deadlineThisWeek,
          noDeadline: nl.views.deadlineNone,
          range: nl.views.deadlineRange,
        }[filter.deadline.kind] ?? filter.deadline.kind;
      out.push({
        key: "deadline",
        label: `${nl.views.filterGroupDeadline}: ${label}`,
        remove: (patch) => patch({ deadline: null }),
      });
    }
    for (const a of filter.attributes) {
      const extras: string[] = [];
      if (a.withValue) extras.push(nl.views.filterFilledIn);
      if (a.withoutValue) extras.push(nl.views.filterNotFilledIn);
      if (a.boolValue === true) extras.push(nl.views.filterChecked);
      if (a.boolValue === false) extras.push(nl.views.filterUnchecked);
      const count = a.optionIds.length + extras.length;
      if (count === 0) continue;
      out.push({
        key: `attr-${a.attributeId}`,
        label: `${nl.views.filterGroupGlobalAttrs}${
          extras.length ? ` · ${extras.join(", ")}` : ""
        } (${count})`,
        remove: (patch) =>
          patch({
            attributes: filter.attributes.filter(
              (x) => x.attributeId !== a.attributeId,
            ),
          }),
      });
    }
    return out;
  }, [filter, statuses, projects]);
}

const metaCount: CSSProperties = {
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-semibold)",
  color: "var(--text-muted)",
  whiteSpace: "nowrap",
};
const tabRow: CSSProperties = {
  display: "flex",
  gap: "var(--space-1)",
  alignSelf: "flex-end",
};
const tab: CSSProperties = {
  padding: "8px 15px 11px",
  border: 0,
  borderBottom: "3px solid transparent",
  background: "transparent",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-lg)",
  cursor: "pointer",
  color: "var(--text-secondary)",
};
