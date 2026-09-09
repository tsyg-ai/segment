import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { nl } from "@/i18n";

/* A `reminder://open` event opens the taakdetailpaneel for the given `todo_id`
   and switches to the Taken (Lijst) view. */

type EventHandler = (event: { payload: unknown }) => void;
const handlers = new Map<string, EventHandler>();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((name: string, handler: EventHandler) => {
    handlers.set(name, handler);
    return Promise.resolve(() => handlers.delete(name));
  }),
  emit: vi.fn().mockResolvedValue(undefined),
  once: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
  openPath: vi.fn().mockResolvedValue(undefined),
}));

const invoke = vi.fn();
vi.mock("@/lib/ipc", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
  isAppError: (v: unknown) =>
    typeof v === "object" && v !== null && "code" in v && "message" in v,
}));

const todo = {
  id: 42,
  projectId: null,
  position: null,
  title: "Terugkoppeling leerkracht",
  description: "",
  statusId: 1,
  deadlineDate: null,
  deadlineTime: null,
  createdAt: "",
  links: [],
  attributeValues: [],
  reminders: [],
};

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
];

beforeEach(() => {
  handlers.clear();
  window.location.hash = "";
  invoke.mockReset();
  invoke.mockImplementation((cmd: string, args?: { id?: number }) => {
    switch (cmd) {
      case "list_todos":
      case "list_todos_view":
        return Promise.resolve([todo]);
      case "count_visible_and_late":
        return Promise.resolve({ visible: 1, total: 1, late: 0 });
      case "get_view_prefs":
        return Promise.resolve(null);
      case "list_attribute_columns":
        return Promise.resolve([]);
      case "list_statuses":
        return Promise.resolve(statuses);
      case "list_attributes":
        return Promise.resolve([]);
      case "list_projects":
        return Promise.resolve([]);
      case "get_todo":
        return Promise.resolve(args?.id === todo.id ? todo : null);
      default:
        return Promise.resolve(null);
    }
  });
});

describe("reminder deep-link", () => {
  it("opens the taakdetailpaneel for the todo_id carried by the event", async () => {
    const { App } = await import("@/App");
    render(<App />);

    // Starts on the dashboard — no panel, no get_todo yet.
    expect(invoke).not.toHaveBeenCalledWith("get_todo", expect.anything());

    // The notification click fires this event from the Rust side.
    const handler = handlers.get("reminder://open");
    expect(handler, "AppShell subscribes to reminder://open").toBeTruthy();
    handler!({ payload: todo.id });

    // Navigates to Taken (Lijst) and opens the panel for that taak.
    await waitFor(() => expect(window.location.hash).toBe("#/taken"));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("get_todo", { id: todo.id }),
    );
    // The taak shows in the list row *and* in the opened detail panel.
    const shown = await screen.findAllByText(todo.title);
    expect(shown.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: "Paneel sluiten" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: nl.nav.tasks, level: 1 }),
    ).toBeInTheDocument();
  });
});
