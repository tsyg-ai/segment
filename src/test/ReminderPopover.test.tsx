import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReminderPopover } from "@/components/reminders/ReminderPopover";
import type { Status } from "@/lib/statusTypes";

const STATUSES: Status[] = [
  {
    id: 1,
    name: "Te doen",
    color: "#5E6A65",
    position: 1,
    isDefault: true,
    isDone: false,
    todoCount: 0,
  },
  {
    id: 2,
    name: "Bezig",
    color: "#96701A",
    position: 2,
    isDefault: false,
    isDone: false,
    todoCount: 0,
  },
  {
    id: 3,
    name: "Klaar",
    color: "#1F6F66",
    position: 3,
    isDefault: false,
    isDone: true,
    todoCount: 0,
  },
];

function setup(props: Partial<React.ComponentProps<typeof ReminderPopover>> = {}) {
  const onSubmit = vi.fn();
  render(
    <ReminderPopover
      statuses={STATUSES}
      allowSiblings
      onSubmit={onSubmit}
      onCancel={() => {}}
      {...props}
    />,
  );
  return { onSubmit, user: userEvent.setup() };
}

describe("ReminderPopover — the five mockup variants", () => {
  it("1a — 1 dag vóór de deadline van deze taak", async () => {
    const { onSubmit, user } = setup();
    await user.click(screen.getByRole("button", { name: "Toevoegen" }));
    expect(onSubmit).toHaveBeenCalledWith({
      mode: "relative",
      anchor: "this_todo",
      basis: "deadline",
      triggerStatusId: null,
      offsetValue: 1,
      offsetUnit: "days",
      offsetDirection: "before",
      fireTime: "09:00",
    });
  });

  it("2a — vaste datum + tijd", async () => {
    const { onSubmit, user } = setup();
    await user.click(screen.getByRole("tab", { name: "Vaste datum" }));
    // Belgian DD/MM/YYYY input; commits on blur.
    const dateField = screen.getByLabelText("Datum");
    await user.clear(dateField);
    await user.type(dateField, "03/09/2026");
    await user.tab();
    const timeField = screen.getByLabelText("Tijd");
    await user.clear(timeField);
    await user.type(timeField, "09:00");
    await user.tab();
    await user.click(screen.getByRole("button", { name: "Toevoegen" }));
    expect(onSubmit).toHaveBeenCalledWith({
      mode: "absolute",
      fireAtLiteral: "2026-09-03 09:00:00",
    });
  });

  it("2b — 4 uren ná status van de vorige taak (geen tijdstip)", async () => {
    const { onSubmit, user } = setup();
    await user.selectOptions(screen.getByLabelText("Basis"), "status");
    await user.selectOptions(screen.getByLabelText("Anker"), "previous_todo");
    await user.selectOptions(screen.getByLabelText("Eenheid"), "hours");
    fireEvent.change(screen.getByLabelText("Aantal"), { target: { value: "4" } });
    await user.selectOptions(screen.getByLabelText("Vanaf status"), "2");
    await user.click(screen.getByRole("button", { name: "Toevoegen" }));
    expect(onSubmit).toHaveBeenCalledWith({
      mode: "relative",
      anchor: "previous_todo",
      basis: "status",
      triggerStatusId: 2,
      offsetValue: 4,
      offsetUnit: "hours",
      offsetDirection: "after",
      fireTime: null,
    });
  });

  it("2c — 2 dagen vóór de deadline van de volgende taak", async () => {
    const { onSubmit, user } = setup();
    await user.selectOptions(screen.getByLabelText("Anker"), "next_todo");
    fireEvent.change(screen.getByLabelText("Aantal"), { target: { value: "2" } });
    await user.click(screen.getByRole("button", { name: "Toevoegen" }));
    expect(onSubmit).toHaveBeenCalledWith({
      mode: "relative",
      anchor: "next_todo",
      basis: "deadline",
      triggerStatusId: null,
      offsetValue: 2,
      offsetUnit: "days",
      offsetDirection: "before",
      fireTime: "09:00",
    });
  });

  it("2d — 1 dag ná status van deze taak (wél tijdstip)", async () => {
    const { onSubmit, user } = setup();
    await user.selectOptions(screen.getByLabelText("Basis"), "status");
    await user.selectOptions(screen.getByLabelText("Vanaf status"), "2");
    await user.click(screen.getByRole("button", { name: "Toevoegen" }));
    expect(onSubmit).toHaveBeenCalledWith({
      mode: "relative",
      anchor: "this_todo",
      basis: "status",
      triggerStatusId: 2,
      offsetValue: 1,
      offsetUnit: "days",
      offsetDirection: "after",
      fireTime: "09:00",
    });
  });
});

describe("ReminderPopover — rules the sentence enforces", () => {
  it('"vóór" disappears once basis = status; direction shows a fixed "ná"', async () => {
    const { user } = setup();
    // deadline basis: the direction control is a real combobox with "vóór"
    const dir = screen.getByLabelText("Richting");
    expect(dir.tagName).toBe("SELECT");

    await user.selectOptions(screen.getByLabelText("Basis"), "status");

    // now it is a static element reading "ná", not a combobox
    expect(screen.queryByRole("combobox", { name: "Richting" })).toBeNull();
    expect(screen.getByLabelText("Richting")).toHaveTextContent("ná");
  });

  it("in template context a relative reminder shows it is computed per project", () => {
    setup({ context: "template" });
    expect(screen.getByText(/automatisch berekend per project/i)).toBeInTheDocument();
  });
});
