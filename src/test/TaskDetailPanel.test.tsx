import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/queryClient";
import { nl } from "@/i18n";
import { DeleteProjectDialog } from "@/pages/ProjectsPage";
import type { Project } from "@/lib/taskTypes";

const invoke = vi.fn();
vi.mock("@/lib/ipc", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
  isAppError: (v: unknown) =>
    typeof v === "object" && v !== null && "code" in v && "message" in v,
}));
vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
  openPath: vi.fn().mockResolvedValue(undefined),
}));

import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";

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
    name: "Klaar",
    color: "#000",
    position: 3,
    isDefault: false,
    isDone: true,
    todoCount: 0,
  },
];

const todo = {
  id: 7,
  projectId: null,
  position: null,
  title: "Mijn taak",
  description:
    "Regel een. Regel twee met wat meer tekst zodat de omschrijving over drie lijnen loopt en de Meer-knop verschijnt zonder twijfel.",
  statusId: 1,
  deadlineDate: null,
  deadlineTime: null,
  createdAt: "",
  links: [],
  attributeValues: [],
  reminders: [],
};

beforeEach(() => {
  invoke.mockReset();
  invoke.mockImplementation((cmd: string) => {
    switch (cmd) {
      case "list_statuses":
        return Promise.resolve(statuses);
      case "list_attributes":
        return Promise.resolve([]);
      case "list_projects":
        return Promise.resolve([]);
      case "get_todo":
        return Promise.resolve(todo);
      case "update_todo":
        return Promise.resolve({ ...todo, title: "Aangepast" });
      case "delete_todo":
        return Promise.resolve(null);
      default:
        return Promise.resolve(null);
    }
  });
});

function renderPanel(onDeleted = vi.fn()) {
  const qc = makeQueryClient();
  render(
    <QueryClientProvider client={qc}>
      <TaskDetailPanel
        todoId={7}
        onClose={vi.fn()}
        onDeleted={onDeleted}
        onOpenOther={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return { onDeleted };
}

describe("TaskDetailPanel — klik-de-waarde-om-te-bewerken", () => {
  it("edits the title inline: click the value, type, blur → update_todo", async () => {
    const user = userEvent.setup();
    renderPanel();
    const title = await screen.findByText("Mijn taak");
    await user.click(title);
    const input = screen.getByDisplayValue("Mijn taak");
    await user.clear(input);
    await user.type(input, "Aangepast");
    input.blur();
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        "update_todo",
        expect.objectContaining({ id: 7, input: { title: "Aangepast" } }),
      ),
    );
  });

  it("collapses the omschrijving behind Meer / Minder", async () => {
    const user = userEvent.setup();
    renderPanel();
    const more = await screen.findByRole("button", { name: nl.tasks.moreButton });
    await user.click(more);
    expect(
      screen.getByRole("button", { name: nl.tasks.lessButton }),
    ).toBeInTheDocument();
  });

  it("opens the status menu on click and picks another status", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Mijn taak");
    await user.click(screen.getByRole("button", { name: /Te doen/ }));
    const menu = screen.getByRole("listbox", { name: nl.tasks.statusLabel });
    await user.click(within(menu).getByRole("option", { name: /Klaar/ }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("set_todo_status", {
        todoId: 7,
        statusId: 2,
      }),
    );
  });

  it("saves the date alone, then adds a 24h time via the picker", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Mijn taak");
    await user.click(screen.getByText(nl.tasks.deadlineNone));

    // Dates are entered and shown in Belgian DD/MM/YYYY format.
    const dateInput = screen.getByLabelText(nl.tasks.deadlineDate) as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "15/09/2026" } });
    fireEvent.blur(dateInput);
    // Date persists on its own — no time required.
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("set_todo_deadline", {
        todoId: 7,
        date: "2026-09-15",
        time: null,
      }),
    );

    // Time is a 24h dropdown, never AM/PM.
    await user.click(screen.getByRole("button", { name: nl.tasks.deadlineTime }));
    await user.click(screen.getByRole("option", { name: "09:15" }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("set_todo_deadline", {
        todoId: 7,
        date: "2026-09-15",
        time: "09:15",
      }),
    );
  });

  it("adds a link through the modal", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Mijn taak");
    await user.click(screen.getByRole("button", { name: nl.tasks.linkAddTitle }));
    const dialog = screen.getByRole("dialog", { name: nl.tasks.linkAddTitle });
    await user.type(
      within(dialog).getByPlaceholderText(nl.tasks.linkUrlPlaceholder),
      "https://example.test",
    );
    await user.click(within(dialog).getByRole("button", { name: nl.beheer.add }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("add_todo_link", {
        todoId: 7,
        url: "https://example.test",
        title: null,
      }),
    );
  });

  it("deletes via the confirmation dialog", async () => {
    const user = userEvent.setup();
    const { onDeleted } = renderPanel();
    const del = await screen.findByRole("button", { name: nl.tasks.delete });
    await user.click(del);
    const dialog = screen.getByRole("dialog", {
      name: nl.tasks.deleteTitle("Mijn taak"),
    });
    await user.click(within(dialog).getByRole("button", { name: nl.tasks.deleteVerb }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("delete_todo", { id: 7 }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });
});

describe("DeleteProjectDialog — typ de projectnaam", () => {
  const project: Project = {
    id: 1,
    name: "Jan Peeters",
    color: "#7A8F6E",
    templateId: null,
    templateName: null,
    state: "active",
    createdAt: "",
    completedAt: null,
    archivedAt: null,
    todoCount: 2,
    doneCount: 0,
  };

  it("keeps the confirm button disabled until the name matches exactly", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <DeleteProjectDialog
        project={project}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    const confirm = screen.getByRole("button", { name: nl.projects.deleteVerb });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByRole("textbox"), "jan peeters");
    expect(confirm).toBeDisabled();

    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "Jan Peeters");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("Jan Peeters");
  });
});
