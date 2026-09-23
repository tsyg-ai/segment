import { useCallback, useEffect, useState } from "react";
import { useViewState } from "@/store/useViewState";
import { Sidebar } from "./Sidebar";
import { useRoute } from "./useRoute";
import { useReminderDeepLink } from "./useReminderDeepLink";
import type { Destination } from "./routes";
import { TakenView } from "@/views/TakenView";
import { StatusesPage } from "@/pages/StatusesPage";
import { AttributesPage } from "@/pages/AttributesPage";
import { TemplatesPage } from "@/pages/TemplatesPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { UpdateGate } from "@/components/update/UpdateAvailableDialog";

/**
 * Fixed shell (readme "Layout"): 236px sidebar + fluid main. The OS window is
 * the frame — no fake 18px window border inside the app. Header/footer are
 * `flex:none`; only the view body scrolls.
 */
export function AppShell() {
  const [route, navigate] = useRoute();
  const subView = useViewState((s) => s.subView);
  const setSubView = useViewState((s) => s.setSubView);
  const requestOpenTodo = useViewState((s) => s.requestOpenTodo);
  const setSearch = useViewState((s) => s.setSearch);
  const clearSelection = useViewState((s) => s.clearSelection);

  // Keep the shared store in sync with a deep-linked Kalender sub-view.
  useEffect(() => {
    if (route.dest === "taken" && route.sub !== subView) {
      setSubView(route.sub);
    }
  }, [route, subView, setSubView]);

  // Navigating away from Taken wipes the search term (spec §8.2) and drops the
  // selection — the shared *filter* is deliberately kept.
  useEffect(() => {
    if (route.dest !== "taken") {
      setSearch("");
      clearSelection();
    }
  }, [route.dest, setSearch, clearSelection]);

  // Notification click → jump to Taken (Lijst) and open the taak.
  const openFromReminder = useCallback(
    (todoId: number) => {
      requestOpenTodo(todoId);
      setSubView("list");
      navigate({ dest: "taken", sub: "list" });
    },
    [requestOpenTodo, setSubView, navigate],
  );
  useReminderDeepLink(openFromReminder);

  // Clicking a sidebar item always lands on that destination's *list* page —
  // also when it is already the active destination and a detail view is open.
  // The counter is the signal the detail-carrying pages reset themselves on.
  const [navSignal, setNavSignal] = useState(0);
  const goto = (dest: Destination) => {
    setNavSignal((n) => n + 1);
    navigate({ dest, sub: "list" });
  };
  const requestNewTask = useViewState((s) => s.requestNewTask);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        background: "var(--surface-app)",
        color: "var(--text-primary)",
      }}
    >
      <Sidebar active={route.dest} onNavigate={goto} />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {route.dest === "dashboard" && (
          <Dashboard
            onGotoTasks={() => goto("taken")}
            onGotoProjects={() => goto("projecten")}
            onGotoTemplates={() => goto("sjablonen")}
            onNewTask={() => {
              requestNewTask(true);
              setSubView("list");
              navigate({ dest: "taken", sub: "list" });
            }}
          />
        )}
        {route.dest === "taken" && (
          <TakenView
            sub={route.sub}
            onSubView={(v) => {
              setSubView(v);
              navigate({ dest: "taken", sub: v });
            }}
          />
        )}
        {route.dest === "projecten" && <ProjectsPage navSignal={navSignal} />}
        {route.dest === "sjablonen" && <TemplatesPage navSignal={navSignal} />}
        {route.dest === "kenmerken" && <AttributesPage />}
        {route.dest === "statussen" && <StatusesPage />}
      </main>
      <UpdateGate />
    </div>
  );
}
