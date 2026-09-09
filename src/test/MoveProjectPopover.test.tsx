import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoveProjectPopover } from "@/components/tasks/MoveProjectPopover";
import type { Project } from "@/lib/taskTypes";
import { nl } from "@/i18n";

function project(over: Partial<Project>): Project {
  return {
    id: 1,
    name: "Project",
    color: "#7A8F6E",
    templateId: null,
    templateName: null,
    state: "active",
    createdAt: "",
    completedAt: null,
    archivedAt: null,
    todoCount: 0,
    doneCount: 0,
    ...over,
  };
}

describe("MoveProjectPopover", () => {
  const projects = [
    project({ id: 1, name: "HGD Jan" }),
    project({ id: 2, name: "HGD Els" }),
    project({ id: 3, name: "Gearchiveerd", state: "archived" }),
  ];

  it('offers "Losse taak, geen project" and marks the current project', () => {
    render(
      <MoveProjectPopover
        projects={projects}
        currentProjectId={1}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(nl.tasks.noProject)).toBeInTheDocument();
    expect(screen.getByText(nl.tasks.moveCurrent)).toBeInTheDocument();
    // archived projects are not offered as a target
    expect(screen.queryByText("Gearchiveerd")).not.toBeInTheDocument();
  });

  it("filters by the search field and reports the picked target", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <MoveProjectPopover
        projects={projects}
        currentProjectId={1}
        onPick={onPick}
        onClose={vi.fn()}
      />,
    );
    await user.type(screen.getByPlaceholderText(nl.tasks.moveSearch), "Els");
    expect(screen.queryByText("HGD Jan")).not.toBeInTheDocument();
    await user.click(screen.getByText("HGD Els"));
    expect(onPick).toHaveBeenCalledWith(2);
  });
});
