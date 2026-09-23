/* eslint-disable @typescript-eslint/no-explicit-any -- mock IPC payloads are dynamic */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { nl } from "@/i18n";

/* Dashboard, Kalender, onboarding & update-modal. */

const invoke = vi.fn();
vi.mock("@/lib/ipc", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
  isAppError: (v: unknown) =>
    typeof v === "object" && v !== null && "code" in v && "message" in v,
}));

const listenHandlers: Record<string, (e: { payload: unknown }) => void> = {};
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((name: string, cb: (e: { payload: unknown }) => void) => {
    listenHandlers[name] = cb;
    return Promise.resolve(() => delete listenHandlers[name]);
  }),
  emit: vi.fn().mockResolvedValue(undefined),
  once: vi.fn().mockResolvedValue(() => {}),
}));

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

const project = {
  id: 7,
  name: "HGD-traject",
  color: "#7A8F6E",
  templateId: null,
  templateName: null,
  state: "active" as const,
  createdAt: "",
  completedAt: null,
  archivedAt: null,
  todoCount: 4,
  doneCount: 1,
};

function snapshot(late: boolean) {
  return {
    lastActiveAt: "2026-09-01 08:00:00",
    lateCount: late ? 1 : 0,
    reminders: [
      ...(late
        ? [
            {
              reminderId: 100,
              todoId: 20,
              title: "Oudergesprek voorbereiden",
              projectName: "HGD-traject",
              position: 4,
              projectTodoCount: 7,
              state: "late",
              fireAt: "2026-09-02 09:00:00",
              wasLate: true,
            },
          ]
        : []),
      {
        reminderId: 101,
        todoId: 21,
        title: "Materiaal klaarleggen",
        projectName: "HGD-traject",
        position: 5,
        projectTodoCount: 7,
        state: "pending",
        fireAt: "2026-09-20 16:00:00",
        wasLate: false,
      },
    ],
    deadlines: [
      {
        todoId: 30,
        title: "Verslag afwerken",
        projectName: "HGD-traject",
        position: 3,
        projectTodoCount: 7,
        statusName: "Bezig",
        deadlineDate: "2026-08-30",
        deadlineTime: null,
        missed: true,
      },
    ],
    activeProjects: [project],
    activeProjectCount: 1,
    projectCount: 2,
    looseTodoCount: 3,
  };
}

beforeEach(() => {
  invoke.mockReset();
  for (const k of Object.keys(listenHandlers)) delete listenHandlers[k];
});

// ======================================================================
// Dashboard
// ======================================================================

describe("Dashboard", () => {
  async function renderDashboard() {
    const { Dashboard } = await import("@/components/dashboard/Dashboard");
    const user = userEvent.setup();
    const onGotoTemplates = vi.fn();
    wrap(
      <Dashboard
        onGotoTasks={vi.fn()}
        onGotoProjects={vi.fn()}
        onGotoTemplates={onGotoTemplates}
        onNewTask={vi.fn()}
      />,
    );
    return { user, onGotoTemplates };
  }

  it("rendert de banner + de drie blokken voor de fixture", async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "dashboard_snapshot") return Promise.resolve(snapshot(true));
      if (cmd === "onboarding_state")
        return Promise.resolve({ hasTemplate: true, hasProject: true, hasTodo: true });
      return Promise.resolve(null);
    });
    await renderDashboard();

    expect(
      await screen.findByText(/1 herinnering kon niet gestuurd worden/),
    ).toBeInTheDocument();
    expect(screen.getByText(nl.dashboard.sectionReminders)).toBeInTheDocument();
    expect(screen.getByText(nl.dashboard.sectionDeadlines)).toBeInTheDocument();
    expect(screen.getByText(nl.dashboard.sectionProjects)).toBeInTheDocument();
    expect(screen.getByText("Oudergesprek voorbereiden")).toBeInTheDocument();
    expect(screen.getByText("Verslag afwerken")).toBeInTheDocument();
    expect(screen.getByText("HGD-traject")).toBeInTheDocument();
  });

  it("'Markeer als gezien' laat de late-rij uit de banner én de sectie vallen", async () => {
    let hasLate = true;
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "dashboard_snapshot") return Promise.resolve(snapshot(hasLate));
      if (cmd === "mark_all_late_seen") {
        hasLate = false;
        return Promise.resolve(1);
      }
      if (cmd === "onboarding_state")
        return Promise.resolve({ hasTemplate: true, hasProject: true, hasTodo: true });
      return Promise.resolve(null);
    });
    const { user } = await renderDashboard();

    await screen.findByText(/1 herinnering kon niet gestuurd worden/);
    await user.click(screen.getByRole("button", { name: nl.dashboard.bannerMarkSeen }));

    expect(invoke).toHaveBeenCalledWith("mark_all_late_seen", {});
    await waitFor(() => expect(screen.getByText(/Niets te laat/)).toBeInTheDocument());
    expect(screen.queryByText("Oudergesprek voorbereiden")).not.toBeInTheDocument();
  });

  it("een rij per herinnering op 'gezien' zetten roept mark_reminder_seen aan", async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "dashboard_snapshot") return Promise.resolve(snapshot(true));
      if (cmd === "mark_reminder_seen") return Promise.resolve(null);
      if (cmd === "onboarding_state")
        return Promise.resolve({ hasTemplate: true, hasProject: true, hasTodo: true });
      return Promise.resolve(null);
    });
    const { user } = await renderDashboard();

    await screen.findByText("Oudergesprek voorbereiden");
    const rowSeen = screen.getAllByRole("button", {
      name: nl.dashboard.markRowSeen,
    });
    await user.click(rowSeen[0]);
    expect(invoke).toHaveBeenCalledWith("mark_reminder_seen", { reminderId: 100 });
  });

  it("een taakrij klikken opent het detailpaneel ter plaatse (niet Taken)", async () => {
    invoke.mockImplementation((cmd: string, args?: any) => {
      if (cmd === "dashboard_snapshot") return Promise.resolve(snapshot(true));
      if (cmd === "onboarding_state")
        return Promise.resolve({ hasTemplate: true, hasProject: true, hasTodo: true });
      if (cmd === "list_projects") return Promise.resolve([project]);
      if (cmd === "list_statuses")
        return Promise.resolve([
          { id: 1, name: "Te doen", isDefault: true, isDone: false, position: 1 },
        ]);
      if (cmd === "list_attributes") return Promise.resolve([]);
      if (cmd === "get_todo" && args?.id === 20)
        return Promise.resolve({
          id: 20,
          projectId: 7,
          position: 4,
          title: "Oudergesprek voorbereiden",
          description: "",
          statusId: 1,
          deadlineDate: null,
          deadlineTime: null,
          createdAt: "",
          links: [],
          attributeValues: [],
          reminders: [],
        });
      return Promise.resolve(null);
    });
    const { user } = await renderDashboard();

    await user.click(await screen.findByText("Oudergesprek voorbereiden"));

    // Het detailpaneel verschijnt...
    expect(
      await screen.findByRole("button", { name: "Paneel sluiten" }),
    ).toBeInTheDocument();
    expect(screen.getByText(nl.tasks.panelEditHint)).toBeInTheDocument();
    // ...en het dashboard blijft staan (geen sprong naar Taken).
    expect(screen.getByText(nl.dashboard.sectionDeadlines)).toBeInTheDocument();
    expect(screen.getByText(nl.dashboard.sectionProjects)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("get_todo", { id: 20 });
  });

  it("toont de uitleg-onboarding bij een lege box en stuurt naar de sjablonen", async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "dashboard_snapshot") return Promise.resolve(snapshot(false));
      if (cmd === "onboarding_state")
        return Promise.resolve({
          hasTemplate: false,
          hasProject: false,
          hasTodo: false,
        });
      return Promise.resolve(null);
    });
    const { user, onGotoTemplates } = await renderDashboard();
    expect(await screen.findByText(nl.onboarding.dashboard.title)).toBeInTheDocument();
    expect(screen.getByText(nl.onboarding.dashboard.step1Title)).toBeInTheDocument();
    expect(screen.getByText(nl.onboarding.dashboard.step4Title)).toBeInTheDocument();

    await user.click(screen.getByText(nl.onboarding.dashboard.cta));
    expect(onGotoTemplates).toHaveBeenCalledOnce();
  });
});

// ======================================================================
// Onboarding-lege-toestand
// ======================================================================

describe("OnboardingEmptyState", () => {
  it("toont 'Stap X van 3' en de primaire actie, en roept onAction aan", async () => {
    const { OnboardingEmptyState } =
      await import("@/components/onboarding/OnboardingEmptyState");
    const onAction = vi.fn();
    const user = userEvent.setup();
    wrap(
      <OnboardingEmptyState
        step={2}
        title="Nog geen projecten"
        body="uitleg"
        actionLabel="Project starten"
        onAction={onAction}
        hint="hint"
      />,
    );
    expect(screen.getByText(nl.onboarding.step(2))).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Project starten" }));
    expect(onAction).toHaveBeenCalled();
  });

  it("toont 'Optioneel' voor Kenmerken (geen stapnummer)", async () => {
    const { OnboardingEmptyState } =
      await import("@/components/onboarding/OnboardingEmptyState");
    wrap(
      <OnboardingEmptyState
        step="optional"
        title="Nog geen kenmerken"
        body="uitleg"
        actionLabel="Kenmerk toevoegen"
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText(nl.onboarding.optional)).toBeInTheDocument();
    expect(screen.queryByText(/Stap \d van 3/)).not.toBeInTheDocument();
  });
});

// ======================================================================
// Update-modal
// ======================================================================

describe("UpdateAvailableDialog", () => {
  it("'Later' sluit zonder te downloaden", async () => {
    const { UpdateAvailableDialog } =
      await import("@/components/update/UpdateAvailableDialog");
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    wrap(
      <UpdateAvailableDialog
        info={{ version: "0.2.0", notes: null }}
        onDismiss={onDismiss}
      />,
    );
    await user.click(screen.getByRole("button", { name: nl.update.later }));
    expect(onDismiss).toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalledWith("confirm_update", expect.anything());
  });

  it("'Nu bijwerken' roept confirm_update aan", async () => {
    invoke.mockImplementation((cmd: string) =>
      cmd === "confirm_update" ? new Promise(() => {}) : Promise.resolve(null),
    );
    const { UpdateAvailableDialog } =
      await import("@/components/update/UpdateAvailableDialog");
    const user = userEvent.setup();
    wrap(
      <UpdateAvailableDialog
        info={{ version: "0.2.0", notes: "Bugfixes" }}
        onDismiss={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: nl.update.confirm }));
    expect(invoke).toHaveBeenCalledWith("confirm_update", {});
  });
});

// ======================================================================
// Kalender
// ======================================================================

describe("CalendarView", () => {
  const events = [
    {
      id: "d-30",
      kind: "deadline",
      todoId: 30,
      title: "Handelingsplan evalueren",
      projectName: "HGD-traject",
      at: "2026-09-15 00:00:00",
      allDay: true,
      tone: "neutral",
    },
  ];

  async function renderCalendar() {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "calendar_events") return Promise.resolve(events);
      return Promise.resolve(null);
    });
    const { useViewState } = await import("@/store/useViewState");
    useViewState.getState().reset();
    const { CalendarView } = await import("@/components/views/CalendarView");
    const onOpen = vi.fn();
    const user = userEvent.setup();
    wrap(<CalendarView onOpen={onOpen} />);
    return { user, onOpen };
  }

  it("wisselt tussen Maand en Week", async () => {
    const { user } = await renderCalendar();
    const week = screen.getByRole("button", { name: nl.calendar.week });
    expect(screen.getByRole("button", { name: nl.calendar.month })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(week);
    expect(week).toHaveAttribute("aria-pressed", "true");
  });

  it("vraagt de events op met een datumbereik", async () => {
    await renderCalendar();
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        "calendar_events",
        expect.objectContaining({
          from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        }),
      ),
    );
  });
});
