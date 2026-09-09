/* eslint-disable @typescript-eslint/no-explicit-any -- mock IPC payloads are dynamic */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { nl } from "@/i18n";
import { kanbanDrop } from "@/components/views/KanbanBoard";
import type { Todo } from "@/lib/taskTypes";

/* Takenviews & gedeelde filter (spec §8, §8.1, §8.2). */

const statuses = [
  {
    id: 1,
    name: "Te doen",
    color: "#000",
    position: 1,
    isDefault: true,
    isDone: false,
    todoCount: 0,
  },
  {
    id: 2,
    name: "Bezig",
    color: "#000",
    position: 2,
    isDefault: false,
    isDone: false,
    todoCount: 0,
  },
  {
    id: 3,
    name: "Klaar",
    color: "#000",
    position: 3,
    isDefault: false,
    isDone: true,
    todoCount: 0,
  },
  {
    id: 4,
    name: "Review",
    color: "#000",
    position: 4,
    isDefault: false,
    isDone: false,
    todoCount: 0,
  },
  {
    id: 5,
    name: "Wacht",
    color: "#000",
    position: 5,
    isDefault: false,
    isDone: false,
    todoCount: 0,
  },
];

const projects = [
  {
    id: 10,
    name: "Zonnebloem",
    color: "#7A8F6E",
    templateId: null,
    templateName: null,
    state: "active" as const,
    createdAt: "",
    completedAt: null,
    archivedAt: null,
    todoCount: 2,
    doneCount: 0,
  },
];

const todo = (over: Partial<Todo>): Todo => ({
  id: 1,
  projectId: 10,
  position: 1,
  title: "Taak",
  description: "",
  statusId: 1,
  deadlineDate: null,
  deadlineTime: null,
  createdAt: "2026-09-01 09:00:00",
  links: [],
  attributeValues: [],
  reminders: [],
  ...over,
});

const allTodos: Todo[] = [
  todo({ id: 1, title: "Intakegesprek", statusId: 1 }),
  todo({
    id: 2,
    title: "Verslag afwerken",
    statusId: 2,
    description: "met intake erin",
  }),
];

let lastListArgs: { filter?: unknown; search?: string } = {};
const invoke = vi.fn();
const prefsStore: Record<string, unknown> = {};

vi.mock("@/lib/ipc", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
  isAppError: (v: unknown) =>
    typeof v === "object" && v !== null && "code" in v && "message" in v,
}));

function applyFilterSearch(args: { filter?: any; search?: string }): Todo[] {
  let rows = allTodos;
  const s = (args.search ?? "").trim().toLowerCase();
  if (s) {
    rows = rows.filter(
      (t) =>
        t.title.toLowerCase().includes(s) ||
        t.description.toLowerCase().includes(s) ||
        "zonnebloem".includes(s),
    );
  }
  const statusIds: number[] = args.filter?.statusIds ?? [];
  if (statusIds.length) rows = rows.filter((t) => statusIds.includes(t.statusId));
  return rows;
}

beforeEach(async () => {
  const { queryClient } = await import("@/lib/queryClient");
  queryClient.clear();
  const { useViewState } = await import("@/store/useViewState");
  useViewState.getState().reset();
  useViewState.setState({ subView: "list", filterPanelOpen: false });
  for (const k of Object.keys(prefsStore)) delete prefsStore[k];
  lastListArgs = {};
  window.location.hash = "";
  invoke.mockReset();
  invoke.mockImplementation((cmd: string, args?: any) => {
    switch (cmd) {
      case "list_statuses":
        return Promise.resolve(statuses.slice(0, 3));
      case "list_projects":
        return Promise.resolve(projects);
      case "list_attributes":
        return Promise.resolve([]);
      case "list_attribute_columns":
        return Promise.resolve([]);
      case "list_todos":
        return Promise.resolve(allTodos);
      case "list_todos_view":
        lastListArgs = args;
        return Promise.resolve(applyFilterSearch(args ?? {}));
      case "count_visible_and_late":
        return Promise.resolve({ visible: 2, total: 5, late: 1 });
      case "get_todo":
        return Promise.resolve(allTodos.find((t) => t.id === args?.id) ?? null);
      case "get_view_prefs":
        return Promise.resolve(prefsStore[args.view] ?? null);
      case "set_view_prefs":
        prefsStore[args.view] = args.prefs;
        return Promise.resolve(args.prefs);
      default:
        return Promise.resolve(null);
    }
  });
});

async function renderTaken() {
  const { App } = await import("@/App");
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("link", { name: nl.nav.tasks }));
  await screen.findByRole("heading", { name: nl.nav.tasks, level: 1 });
  return user;
}

describe("gedeelde filter", () => {
  it("blijft behouden bij het wisselen Lijst ↔ Tabel ↔ Kanban", async () => {
    const user = await renderTaken();

    // Open het filterpaneel en filter op status "Bezig".
    await user.click(
      screen.getByRole("button", { name: new RegExp(nl.views.filterTitle) }),
    );
    const panel = await screen.findByRole("complementary", {
      name: nl.views.filterTitle,
    });
    await user.click(within(panel).getByRole("checkbox", { name: "Bezig" }));

    // Chip verschijnt.
    await screen.findByText(/Status: Bezig/);
    await waitFor(() => expect((lastListArgs.filter as any)?.statusIds).toEqual([2]));

    // Naar Tabel — de filterchip blijft, de query draait met dezelfde filter.
    await user.click(screen.getByRole("button", { name: nl.taskViews.table }));
    expect(screen.getByText(/Status: Bezig/)).toBeInTheDocument();

    // Naar Kanban — idem.
    await user.click(screen.getByRole("button", { name: nl.taskViews.kanban }));
    expect(screen.getByText(/Status: Bezig/)).toBeInTheDocument();
    await waitFor(() => expect((lastListArgs.filter as any)?.statusIds).toEqual([2]));
  });

  it("'Niet ingevuld' toggelt de kenmerkfilter in de gedeelde status", async () => {
    const attrs = [
      {
        id: 7,
        name: "Fase",
        type: "select" as const,
        scope: "global" as const,
        templateId: null,
        selectMultiple: false,
        textMultiline: false,
        numberUnit: null,
        checkboxDefault: false,
        options: [
          { id: 71, attributeId: 7, label: "Intake", position: 1, valueCount: 0 },
        ],
        valueCount: 0,
      },
    ];
    invoke.mockImplementation((cmd: string, args?: any) => {
      if (cmd === "list_attributes") return Promise.resolve(attrs);
      if (cmd === "list_statuses") return Promise.resolve(statuses.slice(0, 3));
      if (cmd === "list_projects") return Promise.resolve(projects);
      if (cmd === "list_attribute_columns") return Promise.resolve([]);
      if (cmd === "list_todos_view") {
        lastListArgs = args;
        return Promise.resolve(applyFilterSearch(args ?? {}));
      }
      if (cmd === "count_visible_and_late")
        return Promise.resolve({ visible: 2, total: 5, late: 0 });
      if (cmd === "get_view_prefs") return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const user = await renderTaken();
    await user.click(
      screen.getByRole("button", { name: new RegExp(nl.views.filterTitle) }),
    );
    const panel = await screen.findByRole("complementary", {
      name: nl.views.filterTitle,
    });
    await user.click(
      within(panel).getByRole("checkbox", { name: nl.views.filterNotFilledIn }),
    );

    await waitFor(() =>
      expect((lastListArgs.filter as any)?.attributes).toEqual([
        {
          attributeId: 7,
          optionIds: [],
          withoutValue: true,
          withValue: false,
          boolValue: null,
        },
      ]),
    );
  });
});

describe("zoeken (§8.2)", () => {
  it("zoekt op titel/omschrijving/projectnaam en wist bij het verlaten van Taken", async () => {
    const user = await renderTaken();

    const search = screen.getByPlaceholderText(nl.views.searchPlaceholder);
    await user.type(search, "intake");
    await waitFor(() => expect(lastListArgs.search).toBe("intake"));
    // "Intakegesprek" (titel) en "Verslag afwerken" (omschrijving) blijven over.
    expect(await screen.findByText("Intakegesprek")).toBeInTheDocument();
    expect(await screen.findByText("Verslag afwerken")).toBeInTheDocument();

    // Weg van Taken → zoekterm gewist (spec §8.2).
    const { useViewState } = await import("@/store/useViewState");
    await user.click(screen.getByRole("link", { name: nl.nav.projects }));
    await waitFor(() => expect(useViewState.getState().search).toBe(""));

    await user.click(screen.getByRole("link", { name: nl.nav.tasks }));
    expect(
      (screen.getByPlaceholderText(nl.views.searchPlaceholder) as HTMLInputElement)
        .value,
    ).toBe("");
  });
});

describe("voetbalk (§8)", () => {
  it("toont dezelfde N van M en N te laat", async () => {
    await renderTaken();
    expect(await screen.findByText(nl.footer.visible(2, 5))).toBeInTheDocument();
    expect(screen.getByText(nl.footer.late(1))).toBeInTheDocument();
  });
});

describe("bulkbalk (§1.4)", () => {
  it("verschijnt bij selectie en verdwijnt bij 'Selectie wissen'", async () => {
    const user = await renderTaken();
    const [firstCheckbox] = await screen.findAllByRole("checkbox", {
      name: nl.views.selectTask,
    });
    await user.click(firstCheckbox);

    expect(await screen.findByText(nl.tasks.bulkSelected(1))).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: nl.views.bulkStatus }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: nl.views.bulkDeadline }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: nl.views.bulkClear }));
    expect(screen.queryByText(nl.tasks.bulkSelected(1))).not.toBeInTheDocument();
  });
});

describe("view-lokale voorkeuren (§8.1)", () => {
  it("worden per view apart weggeschreven", async () => {
    const user = await renderTaken();

    // Kanban: de vaste kolomsortering wijzigen via dezelfde Sorteren-knop als
    // de lijst → set_view_prefs voor "kanban".
    await user.click(screen.getByRole("button", { name: nl.taskViews.kanban }));
    await user.click(await screen.findByRole("button", { name: /^Sorteren:/ }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: nl.views.sortByDeadline }),
    );
    await waitFor(() =>
      expect(prefsStore["kanban"]).toMatchObject({
        sort: { id: "deadline", desc: false },
      }),
    );

    // Lijst: groepering wijzigen → set_view_prefs voor "list", "kanban" ongemoeid.
    await user.click(screen.getByRole("button", { name: nl.taskViews.list }));
    await user.click(await screen.findByRole("button", { name: /^Groeperen:/ }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: nl.views.groupByStatus }),
    );
    await waitFor(() => expect(prefsStore["list"]).toMatchObject({ group: "status" }));
    expect(prefsStore["kanban"]).toMatchObject({
      sort: { id: "deadline", desc: false },
    });
  });
});

describe("kanban (§8)", () => {
  it("een kaart naar een andere kolom slepen levert een set_todo_status-doel op", () => {
    const rows = [todo({ id: 1, statusId: 1 }), todo({ id: 2, statusId: 2 })];
    expect(kanbanDrop("todo-1", "status-2", rows)).toEqual({ todoId: 1, statusId: 2 });
    // Zelfde kolom → geen wijziging.
    expect(kanbanDrop("todo-1", "status-1", rows)).toBeNull();
    // Buiten een kolom losgelaten → geen wijziging.
    expect(kanbanDrop("todo-1", null, rows)).toBeNull();
  });

  it("het bord toont een kolom per status en '+' opent snel-toevoegen met die status", async () => {
    invoke.mockImplementation((cmd: string, args?: any) => {
      if (cmd === "list_statuses") return Promise.resolve(statuses); // vijf statussen
      if (cmd === "list_projects") return Promise.resolve(projects);
      if (cmd === "list_attributes") return Promise.resolve([]);
      if (cmd === "list_attribute_columns") return Promise.resolve([]);
      if (cmd === "list_todos_view") return Promise.resolve(allTodos);
      if (cmd === "count_visible_and_late")
        return Promise.resolve({ visible: 2, total: 5, late: 0 });
      if (cmd === "get_view_prefs") return Promise.resolve(null);
      if (cmd === "set_view_prefs") return Promise.resolve(args.prefs);
      return Promise.resolve(null);
    });
    const user = await renderTaken();
    await user.click(screen.getByRole("button", { name: nl.taskViews.kanban }));

    // Vijf statuskolommen → het bord schuift horizontaal (5 kolomkoppen).
    for (const s of statuses) {
      expect(await screen.findByText(s.name)).toBeInTheDocument();
    }

    // '+' in de kolom "Bezig" opent de snel-toevoegen-sheet met status voorgevuld.
    await user.click(
      screen.getByRole("button", { name: nl.views.addTaskInStatus("Bezig") }),
    );
    const statusSelect = (await screen.findByRole("combobox", {
      name: nl.tasks.statusLabel,
    })) as HTMLSelectElement;
    expect(statusSelect.value).toBe("2");
  });
});
