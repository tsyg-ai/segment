import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "./ipc";
import { qk } from "./queryKeys";
import type { TodoFilter } from "@/store/useViewState";

/* TanStack Query hooks for the Dashboard snapshot, the Kalender events (fed the
   shared filter + search), and the onboarding state. */

/** The full dashboard snapshot — late banner + the three blocks (spec §7). */
export function useDashboard() {
  return useQuery({
    queryKey: qk.dashboard.all,
    queryFn: () => invoke("dashboard_snapshot", {}),
  });
}

/** "Markeer als gezien" — globally (whole banner) or one row at a time. */
export function useMarkSeen() {
  const qc = useQueryClient();
  const done = () => {
    void qc.invalidateQueries({ queryKey: qk.dashboard.all });
    void qc.invalidateQueries({ queryKey: qk.views.all });
    void qc.invalidateQueries({ queryKey: qk.calendar.all });
    void qc.invalidateQueries({ queryKey: qk.tasks.all });
  };
  return {
    all: useMutation({
      mutationFn: () => invoke("mark_all_late_seen", {}),
      onSuccess: done,
    }),
    one: useMutation({
      mutationFn: (reminderId: number) => invoke("mark_reminder_seen", { reminderId }),
      onSuccess: done,
    }),
  };
}

/** Deadline + reminder events within `[from, to]`, respecting the shared filter. */
export function useCalendarEvents(
  from: string,
  to: string,
  filter: TodoFilter,
  search: string,
) {
  return useQuery({
    queryKey: qk.calendar.range(from, to, filter, search),
    queryFn: () => invoke("calendar_events", { from, to, filter, search }),
  });
}

/** The three onboarding booleans, derived from the data (spec §11). */
export function useOnboarding() {
  return useQuery({
    queryKey: qk.onboarding.all,
    queryFn: () => invoke("onboarding_state", {}),
  });
}
