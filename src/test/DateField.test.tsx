import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DateField,
  isoToDisplayDate,
  displayToIsoDate,
} from "@/components/forms/DateField";

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DateField value={value} onChange={setValue} aria-label="Datum" />
      <output data-testid="iso">{value}</output>
    </>
  );
}

describe("DateField — Belgian DD/MM/YYYY", () => {
  it("converts ISO <-> display", () => {
    expect(isoToDisplayDate("2026-09-15")).toBe("15/09/2026");
    expect(isoToDisplayDate("")).toBe("");
    expect(displayToIsoDate("15/09/2026")).toBe("2026-09-15");
    expect(displayToIsoDate("1/9/26")).toBe("2026-09-01");
    expect(displayToIsoDate("15092026")).toBe("2026-09-15");
    expect(displayToIsoDate("31/02/2026")).toBe(""); // not a real date
    expect(displayToIsoDate("15/09")).toBe(""); // incomplete
  });

  it("shows the incoming ISO value in DD/MM/YYYY", () => {
    render(<Harness initial="2026-09-15" />);
    expect(screen.getByLabelText("Datum")).toHaveValue("15/09/2026");
  });

  it("typed input is masked and committed as ISO on blur", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("Datum");
    await user.type(input, "15092026");
    expect(input).toHaveValue("15/09/2026");
    await user.tab();
    expect(screen.getByTestId("iso")).toHaveTextContent("2026-09-15");
  });

  it("reverts to the last valid value when the text is not a real date", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-09-15" />);
    const input = screen.getByLabelText("Datum");
    await user.clear(input);
    await user.type(input, "31022026");
    await user.tab();
    expect(input).toHaveValue("15/09/2026");
    expect(screen.getByTestId("iso")).toHaveTextContent("2026-09-15");
  });

  it("picks a day from the calendar popover", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-09-15" />);
    await user.click(screen.getByRole("button", { name: "Kalender openen" }));
    // react-day-picker labels day buttons with the localized full date.
    await user.click(screen.getByRole("button", { name: /20 september 2026/i }));
    expect(screen.getByTestId("iso")).toHaveTextContent("2026-09-20");
    expect(screen.getByLabelText("Datum")).toHaveValue("20/09/2026");
  });

  it("clearing the field emits an empty string", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateField value="2026-09-15" onChange={onChange} aria-label="Datum" />);
    const input = screen.getByLabelText("Datum");
    await user.clear(input);
    await user.tab();
    expect(onChange).toHaveBeenCalledWith("");
  });
});
