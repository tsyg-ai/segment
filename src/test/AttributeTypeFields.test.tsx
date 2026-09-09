import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AttributeTypeFields,
  type AttributeTypeValues,
} from "@/components/beheer/AttributeTypeFields";

const base: AttributeTypeValues = {
  selectMultiple: false,
  textMultiline: false,
  numberUnit: "u",
  checkboxDefault: false,
};

function renderFor(type: React.ComponentProps<typeof AttributeTypeFields>["type"]) {
  const onChange = vi.fn();
  render(<AttributeTypeFields type={type} values={base} onChange={onChange} />);
  return { onChange };
}

describe("per-type kenmerk-instelvelden — only the relevant fields", () => {
  it("text shows Lengte and nothing number/select-specific", () => {
    renderFor("text");
    expect(screen.getByText("Lengte")).toBeInTheDocument();
    expect(screen.queryByText("Selectie")).toBeNull();
    expect(screen.queryByText("Voorbeeld")).toBeNull();
  });

  it("number shows Eenheid + Voorbeeld, not Lengte or Decimalen", () => {
    renderFor("number");
    expect(screen.queryByText("Decimalen")).toBeNull();
    expect(screen.getByText("Eenheid")).toBeInTheDocument();
    expect(screen.getByText("Voorbeeld")).toBeInTheDocument();
    expect(screen.queryByText("Lengte")).toBeNull();
  });

  it("date has nothing to set", () => {
    renderFor("date");
    expect(screen.getByText("Niets in te stellen")).toBeInTheDocument();
    expect(screen.queryByText("Eenheid")).toBeNull();
  });

  it("checkbox shows the two-state default, not three", () => {
    renderFor("checkbox");
    expect(screen.getByRole("button", { name: "Leeg" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aangevinkt" })).toBeInTheDocument();
  });

  it("select shows Selectie enkelvoudig/meervoudig", () => {
    renderFor("select");
    expect(screen.getByRole("button", { name: "Enkelvoudig" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Meervoudig" })).toBeInTheDocument();
  });

  it("number rejects a point as decimal separator", async () => {
    const user = userEvent.setup();
    renderFor("number");
    const preview = screen.getByLabelText("Voorbeeld");
    await user.clear(preview);
    await user.type(preview, "1.5");
    expect(screen.getByText(/komma als decimaalteken, geen punt/i)).toBeInTheDocument();
  });
});
