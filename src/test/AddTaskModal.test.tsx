import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/queryClient";
import { nl } from "@/i18n";

const invoke = vi.fn();
vi.mock("@/lib/ipc", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
  isAppError: (v: unknown) =>
    typeof v === "object" && v !== null && "code" in v && "message" in v,
}));

import { AddTaskModal } from "@/components/tasks/AddTaskModal";

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
];

beforeEach(() => {
  invoke.mockReset();
  invoke.mockImplementation((cmd: string) => {
    switch (cmd) {
      case "list_statuses":
        return Promise.resolve(statuses);
      case "list_projects":
        return Promise.resolve([]);
      case "list_attributes":
        return Promise.resolve([]);
      case "create_todo":
        return Promise.resolve({
          id: 99,
          projectId: null,
          position: null,
          title: "Nieuwe taak",
          description: "",
          statusId: 1,
          deadlineDate: null,
          deadlineTime: null,
          createdAt: "",
          links: [],
          attributeValues: [],
          reminders: [],
        });
      default:
        return Promise.resolve(null);
    }
  });
});

function renderModal() {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <AddTaskModal onClose={vi.fn()} onCreated={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("AddTaskModal — snel toevoegen", () => {
  it("adds the task when Enter is pressed in the title field", async () => {
    const user = userEvent.setup();
    renderModal();
    const title = await screen.findByPlaceholderText(nl.tasks.titlePlaceholder);
    await user.type(title, "Intakegesprek{Enter}");

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        "create_todo",
        expect.objectContaining({
          input: expect.objectContaining({ title: "Intakegesprek" }),
        }),
      ),
    );
  });

  it("shows no sjabloonkeuze in the toevoegformulier", async () => {
    renderModal();
    await screen.findByPlaceholderText(nl.tasks.titlePlaceholder);
    expect(screen.queryByText(/sjabloon/i)).not.toBeInTheDocument();
  });
});
