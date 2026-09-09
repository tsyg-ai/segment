import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewAttributeModal, AttributeDetail } from "@/pages/AttributesPage";
import type { AttributeDefinition } from "@/lib/beheerTypes";
import { nl } from "@/i18n";

const selectAttr: AttributeDefinition = {
  id: 7,
  name: "Type",
  type: "select",
  scope: "global",
  templateId: null,
  selectMultiple: false,
  textMultiline: false,
  numberUnit: null,
  checkboxDefault: false,
  options: [
    { id: 1, attributeId: 7, label: "Administratie", position: 1, valueCount: 3 },
    { id: 2, attributeId: 7, label: "Gesprek", position: 2, valueCount: 5 },
  ],
  valueCount: 8,
};

const noop = () => {};

describe("kenmerk type is chosen once, then read-only (spec §4)", () => {
  it("the New-kenmerk modal offers all five type choices", () => {
    render(
      <NewAttributeModal
        templates={[]}
        pending={false}
        onClose={noop}
        onSubmit={vi.fn()}
      />,
    );
    for (const label of ["Keuzelijst", "Tekst", "Getal", "Datum", "Checkbox"]) {
      expect(
        screen.getByRole("button", { name: new RegExp(label) }),
      ).toBeInTheDocument();
    }
  });

  it("the detail panel shows the type as fixed text — no type picker", () => {
    render(
      <AttributeDetail
        attr={selectAttr}
        templateName="—"
        onClose={noop}
        onRename={noop}
        onSetting={noop}
        onAddOption={noop}
        onReorderOptions={noop}
        onOptionMenu={noop}
        onSwitchScope={noop}
        onDelete={noop}
      />,
    );
    // the "staat vast na aanmaken" copy is present
    expect(screen.getByText(nl.attributes.typeReadonly)).toBeInTheDocument();
    // and there is no "Datum"/"Getal" type-choice button to switch to
    expect(screen.queryByRole("button", { name: /^Datum/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Getal/ })).toBeNull();
  });
});
