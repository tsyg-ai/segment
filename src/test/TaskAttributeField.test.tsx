import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskAttributeField } from "@/components/tasks/TaskAttributeField";
import type { AttributeDefinition } from "@/lib/beheerTypes";
import { nl } from "@/i18n";

function attr(over: Partial<AttributeDefinition>): AttributeDefinition {
  return {
    id: 1,
    name: "Kenmerk",
    type: "text",
    scope: "global",
    templateId: null,
    selectMultiple: false,
    textMultiline: false,
    numberUnit: null,
    checkboxDefault: false,
    options: [],
    valueCount: 0,
    ...over,
  };
}

describe("TaskAttributeField — per-type inline model", () => {
  it("number rejects a dot and does not commit a value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TaskAttributeField
        attribute={attr({ type: "number", numberUnit: "u" })}
        value={undefined}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole("textbox");
    await user.type(input, "1.5");
    input.blur();
    expect(screen.getByText(nl.tasks.numberDotError)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    // the unit is a fixed suffix
    expect(screen.getByText("u")).toBeInTheDocument();
  });

  it("number rejects text and does not commit a value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TaskAttributeField
        attribute={attr({ type: "number" })}
        value={undefined}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole("textbox");
    await user.type(input, "abc");
    await user.tab();
    expect(screen.getByText(nl.tasks.numberInvalid)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("number accepts a comma decimal", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TaskAttributeField
        attribute={attr({ type: "number" })}
        value={undefined}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole("textbox");
    await user.type(input, "1,5");
    input.blur();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ attributeId: 1, valueNumber: 1.5 }),
    );
  });

  it("checkbox has two states and starts from checkbox_default", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TaskAttributeField
        attribute={attr({ type: "checkbox", checkboxDefault: true })}
        value={undefined}
        onChange={onChange}
      />,
    );
    const box = screen.getByRole("checkbox");
    expect(box).toBeChecked();
    await user.click(box);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ valueBool: false }),
    );
  });

  it("select shows the snapshotted label when the option is gone", () => {
    render(
      <TaskAttributeField
        attribute={attr({ type: "select", options: [] })}
        value={{
          attributeId: 1,
          optionIds: [],
          optionLabels: ["Verwijderde optie"],
        }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Verwijderde optie")).toBeInTheDocument();
  });
});
