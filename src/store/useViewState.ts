import { create } from "zustand";

/**
 * Shared view state across the Taken views (spec §8.1). The **hard split**:
 * only the {@link TodoFilter} and the search term are shared across Lijst /
 * Tabel / Kanban / Kalender. Sorting, grouping, column visibility and
 * in-column sorting are **view-local** and live in `useViewPrefs` +
 * `user_settings`, never here.
 */
export type TaskSubView = "list" | "table" | "kanban" | "calendar";

/** Deadline filter — presets + a free range (mockup `_filter-takenlijst`). */
export type DeadlineFilter =
  | { kind: "overdue" }
  | { kind: "today" }
  | { kind: "thisWeek" }
  | { kind: "noDeadline" }
  | { kind: "range"; from?: string | null; to?: string | null };

/**
 * One kenmerk group in the filter.
 * - `withoutValue` = the "Niet ingevuld" value.
 * - `withValue` = the "Ingevuld" value (text / number / date kenmerken).
 * - `boolValue` = wanted checkbox state (`true` = aangevinkt, `false` = niet
 *   aangevinkt), `null` when not filtering on it.
 */
export interface AttributeFilter {
  attributeId: number;
  optionIds: number[];
  withoutValue: boolean;
  withValue: boolean;
  boolValue: boolean | null;
}

/** Mirrors `core::views::TodoFilter`. */
export interface TodoFilter {
  statusIds: number[];
  projectIds: number[];
  deadline: DeadlineFilter | null;
  attributes: AttributeFilter[];
}

export const emptyFilter: TodoFilter = {
  statusIds: [],
  projectIds: [],
  deadline: null,
  attributes: [],
};

/** True when nothing is set — drives the "Filter wissen" affordances. */
export function filterIsEmpty(f: TodoFilter): boolean {
  return (
    f.statusIds.length === 0 &&
    f.projectIds.length === 0 &&
    f.deadline == null &&
    !f.attributes.some(
      (a) =>
        a.optionIds.length > 0 || a.withoutValue || a.withValue || a.boolValue != null,
    )
  );
}

export interface ViewState {
  /** Which sub-view of Taken is active. */
  subView: TaskSubView;
  setSubView: (v: TaskSubView) => void;

  /** The shared filter (spec §8.1). */
  filter: TodoFilter;
  setFilter: (f: TodoFilter) => void;
  patchFilter: (patch: Partial<TodoFilter>) => void;
  clearFilter: () => void;

  /** Free-text search — shared while in Taken, wiped on navigating away. */
  search: string;
  setSearch: (q: string) => void;

  /** The dedicated filter panel's open state (chrome degradeert → één pill). */
  filterPanelOpen: boolean;
  setFilterPanelOpen: (open: boolean) => void;

  /** Selected task ids — drives the BulkBar. Shared across the sub-views. */
  selection: Set<number>;
  toggleSelected: (id: number) => void;
  setSelection: (ids: Iterable<number>) => void;
  clearSelection: () => void;

  /**
   * A taak the app should open in the detail panel — set by the
   * `reminder://open` deep-link. The Taken-view consumes it and
   * clears it back to `null`.
   */
  pendingTodoId: number | null;
  requestOpenTodo: (id: number | null) => void;

  /**
   * Set by the Dashboard's "Nieuwe taak" button. The Taken-view
   * consumes it to open the "Taak toevoegen"-modal and clears it back to
   * `false`.
   */
  pendingNewTask: boolean;
  requestNewTask: (v: boolean) => void;

  /** Reset the shared filter + search + selection (voetbalk "wissen"). */
  reset: () => void;
}

const initial = {
  subView: "list" as TaskSubView,
  filter: emptyFilter,
  search: "",
  filterPanelOpen: false,
  selection: new Set<number>(),
  pendingTodoId: null as number | null,
  pendingNewTask: false,
};

export const useViewState = create<ViewState>((set) => ({
  ...initial,
  setSubView: (subView) => set({ subView }),
  setFilter: (filter) => set({ filter }),
  patchFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch } })),
  clearFilter: () => set({ filter: emptyFilter }),
  setSearch: (search) => set({ search }),
  setFilterPanelOpen: (filterPanelOpen) => set({ filterPanelOpen }),
  toggleSelected: (id) =>
    set((s) => {
      const next = new Set(s.selection);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selection: next };
    }),
  setSelection: (ids) => set({ selection: new Set(ids) }),
  clearSelection: () => set({ selection: new Set() }),
  requestOpenTodo: (pendingTodoId) => set({ pendingTodoId }),
  requestNewTask: (pendingNewTask) => set({ pendingNewTask }),
  reset: () => set({ filter: emptyFilter, search: "", selection: new Set() }),
}));
