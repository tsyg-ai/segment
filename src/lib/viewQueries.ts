import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { invoke } from "./ipc";
import { qk } from "./queryKeys";
import type { TodoFilter } from "@/store/useViewState";
import type { ViewPrefs } from "./viewTypes";

/** Shared stable empty so a loading prefs query keeps a constant identity. */
const EMPTY_PREFS: ViewPrefs = {};

/* TanStack Query hooks for the takenviews. The gedeelde filter +
   zoekterm are passed straight through to the Rust query; per-view prefs go
   through `get/set_view_prefs`. */

function bump(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: qk.views.all });
  void qc.invalidateQueries({ queryKey: qk.tasks.all });
  void qc.invalidateQueries({ queryKey: qk.projects.all });
  // Deadline / status edits from the views also feed the Kalender, the
  // onboarding empty state and the Dashboard.
  void qc.invalidateQueries({ queryKey: qk.calendar.all });
  void qc.invalidateQueries({ queryKey: qk.onboarding.all });
  void qc.invalidateQueries({ queryKey: qk.dashboard.all });
}

/** The shared query behind Lijst / Tabel / Kanban. */
export function useFilteredTodos(filter: TodoFilter, search: string) {
  return useQuery({
    queryKey: qk.views.list(filter, search),
    queryFn: () => invoke("list_todos_view", { filter, search }),
  });
}

/** The footer counts (`N van M`, `N te laat`). */
export function useVisibleCounts(filter: TodoFilter, search: string) {
  return useQuery({
    queryKey: qk.views.counts(filter, search),
    queryFn: () => invoke("count_visible_and_late", { filter, search }),
  });
}

/** The dynamic kenmerk columns for the Tabel. */
export function useAttributeColumns() {
  return useQuery({
    queryKey: qk.views.attributeColumns,
    queryFn: () => invoke("list_attribute_columns", {}),
  });
}

/**
 * The view-local prefs for one view (sort / group / column config), persisted
 * per user in `user_settings` (spec §8.1). `setPrefs` merges and writes.
 */
export function useViewPrefs(view: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: qk.views.prefs(view),
    queryFn: async () => {
      const raw = await invoke("get_view_prefs", { view });
      return (raw ?? {}) as ViewPrefs;
    },
  });
  const mutation = useMutation({
    mutationFn: (next: ViewPrefs) => invoke("set_view_prefs", { view, prefs: next }),
    onMutate: (next) => {
      qc.setQueryData(qk.views.prefs(view), next);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.views.prefs(view) }),
  });
  const prefs: ViewPrefs = query.data ?? EMPTY_PREFS;
  const setPrefs = (patch: Partial<ViewPrefs>) =>
    mutation.mutate({ ...prefs, ...patch });
  return { prefs, setPrefs, isLoading: query.isLoading };
}

/** Bulk actions from the bulkbalk — delegate to the per-taak paths in Rust. */
export function useBulkMutations() {
  const qc = useQueryClient();
  const done = () => bump(qc);
  return {
    setStatus: useMutation({
      mutationFn: (v: { ids: number[]; statusId: number }) =>
        invoke("bulk_set_todo_status", v),
      onSuccess: done,
    }),
    setDeadline: useMutation({
      mutationFn: (v: { ids: number[]; date?: string | null; time?: string | null }) =>
        invoke("bulk_set_todo_deadline", v),
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: (ids: number[]) => invoke("bulk_delete_todos", { ids }),
      onSuccess: done,
    }),
  };
}
