import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  NumberValueField,
  parseNumberInput,
} from "@/components/forms/NumberValueField";
import { nl } from "@/i18n";

describe("parseNumberInput — de regel voor élk getalveld", () => {
  it("reads a comma as the decimal separator, at any precision", () => {
    expect(parseNumberInput("1,5")).toEqual({ value: 1.5 });
    expect(parseNumberInput(" 3,14159 ")).toEqual({ value: 3.14159 });
    expect(parseNumberInput("-2")).toEqual({ value: -2 });
  });

  it("treats an empty field as no value", () => {
    expect(parseNumberInput("")).toEqual({ value: null });
    expect(parseNumberInput("   ")).toEqual({ value: null });
  });

  it("refuses a point and anything that is not a number", () => {
    expect(parseNumberInput("1.5")).toEqual({ error: nl.tasks.numberDotError });
    expect(parseNumberInput("abc")).toEqual({ error: nl.tasks.numberInvalid });
    expect(parseNumberInput("1,5,5")).toEqual({ error: nl.tasks.numberInvalid });
  });
});

describe("NumberValueField", () => {
  it("shows a stored value with a comma and the unit as a suffix", () => {
    render(
      <NumberValueField value={1.5} unit="u" ariaLabel="Tijd" onCommit={vi.fn()} />,
    );
    expect(screen.getByLabelText("Tijd")).toHaveValue("1,5");
    expect(screen.getByText("u")).toBeInTheDocument();
  });

  it("commits a valid value on blur and keeps an invalid one uncommitted", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<NumberValueField value={null} ariaLabel="Tijd" onCommit={onCommit} />);
    const input = screen.getByLabelText("Tijd");

    await user.type(input, "abc");
    await user.tab();
    expect(screen.getByText(nl.tasks.numberInvalid)).toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, "2,75");
    await user.tab();
    expect(onCommit).toHaveBeenCalledWith(2.75);
  });
});
