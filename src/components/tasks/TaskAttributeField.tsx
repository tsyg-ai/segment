import { useState, type CSSProperties } from "react";
import { nl } from "@/i18n";
import { NumberValueField } from "@/components/forms/NumberValueField";
import { DateField } from "@/components/forms/DateField";
import { TimeSelect } from "@/components/forms/TimeSelect";
import { Icon } from "@/components/core/Icon";
import type { AttributeDefinition } from "@/lib/beheerTypes";
import type { TodoAttributeValue } from "@/lib/taskTypes";

/**
 * Per-type kenmerk-invulveld voor een echte taak (spec §1.1, mockup
 * `_kenmerk-invulvarianten`). `number` aanvaardt elke waarde met een komma
 * als decimaalteken, weigert een punt en toont `numberUnit` als vaste suffix.
 * Een `select` toont de gekozen waarde(n) als lijst; klikken opent een dropdown
 * om te (de)selecteren. Een `date` gedraagt zich als het deadlineveld: datum in
 * DD/MM/YYYY met kalender-popover plus een optioneel tijdstip via dezelfde
 * kwartier-tijdkiezer.
 */
export function TaskAttributeField({
  attribute,
  value,
  onChange,
}: {
  attribute: AttributeDefinition;
  value: TodoAttributeValue | undefined;
  onChange: (value: TodoAttributeValue) => void;
}) {
  const base = {
    attributeId: attribute.id,
    optionIds: [] as number[],
    optionLabels: [] as string[],
  };
  // Geen <label>-wrapper: die stuurt elke klik door naar het eerste
  // formulierbesturingselement, wat de dropdowns van `select`/`date` heropent.
  return (
    <div style={row}>
      <span style={label}>{attribute.name}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        {attribute.type === "select" ? (
          <SelectField
            attribute={attribute}
            value={value}
            onChange={(optionIds) => onChange({ ...base, optionIds })}
          />
        ) : attribute.type === "checkbox" ? (
          <input
            type="checkbox"
            aria-label={attribute.name}
            checked={value?.valueBool ?? attribute.checkboxDefault}
            onChange={(e) => onChange({ ...base, valueBool: e.target.checked })}
            style={{ justifySelf: "start", width: 16, height: 16 }}
          />
        ) : attribute.type === "number" ? (
          <NumberValueField
            value={value?.valueNumber}
            unit={attribute.numberUnit}
            ariaLabel={attribute.name}
            style={{ ...input, width: 110 }}
            onCommit={(valueNumber) => onChange({ ...base, valueNumber })}
          />
        ) : attribute.type === "date" ? (
          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <DateField
              value={value?.valueDate ?? ""}
              onChange={(iso) =>
                onChange({
                  ...base,
                  valueDate: iso || null,
                  valueTime: iso ? (value?.valueTime ?? null) : null,
                })
              }
              aria-label={attribute.name}
              style={{ ...input, width: "auto" }}
            />
            <TimeSelect
              value={value?.valueTime ?? ""}
              disabled={!value?.valueDate}
              onChange={(t) =>
                onChange({
                  ...base,
                  valueDate: value?.valueDate ?? null,
                  valueTime: t || null,
                })
              }
              aria-label={`${attribute.name} — ${nl.tasks.deadlineTime}`}
            />
          </div>
        ) : (
          <TextInput
            multiline={attribute.textMultiline}
            ariaLabel={attribute.name}
            defaultValue={value?.valueText ?? ""}
            onCommit={(v) => onChange({ ...base, valueText: v || null })}
          />
        )}
      </div>
    </div>
  );
}

/**
 * De keuzelijst-waarde: gekozen opties als lijst, klik opent een dropdown om te
 * (de)selecteren. Een enkelvoudige keuzelijst laat maar één waarde toe en sluit
 * na een keuze; een meervoudige blijft open tot je buiten klikt of op "Klaar".
 */
function SelectField({
  attribute,
  value,
  onChange,
}: {
  attribute: AttributeDefinition;
  value: TodoAttributeValue | undefined;
  onChange: (optionIds: number[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const multiple = attribute.selectMultiple;
  const selectedIds = value?.optionIds ?? [];
  const snapshotLabels = value?.optionLabels ?? [];

  const labelFor = (id: number, i: number) =>
    attribute.options.find((o) => o.id === id)?.label ?? snapshotLabels[i] ?? "?";

  // Chips: de live gekozen opties, of — als er geen id's meer zijn maar wel
  // gesnapshotte labels (optie verwijderd) — die labels als leesbare rest.
  const chips: string[] =
    selectedIds.length > 0 ? selectedIds.map(labelFor) : snapshotLabels;

  const toggle = (id: number) => {
    if (multiple) {
      onChange(
        selectedIds.includes(id)
          ? selectedIds.filter((x) => x !== id)
          : [...selectedIds, id],
      );
    } else {
      onChange(selectedIds[0] === id ? [] : [id]);
      setOpen(false);
    }
  };

  return (
    <div style={{ position: "relative", minWidth: 0 }}>
      <button type="button" onClick={() => setOpen((x) => !x)} style={selectValueBtn}>
        {chips.length > 0 ? (
          <span style={chipList}>
            {chips.map((c, i) => (
              <span key={`${c}-${i}`} style={chip}>
                {c}
              </span>
            ))}
          </span>
        ) : (
          <span style={hint}>{nl.tasks.selectPlaceholder}</span>
        )}
        <Icon name="chevron-down" size={13} style={{ flex: "none", marginTop: 2 }} />
      </button>

      {open ? (
        <>
          <div
            role="presentation"
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 39 }}
          />
          <div style={menu} role="listbox" aria-label={attribute.name}>
            {attribute.options.length === 0 ? (
              <span style={{ ...hint, padding: "6px 10px" }}>{nl.tasks.empty}</span>
            ) : (
              attribute.options.map((o) => {
                const on = selectedIds.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => toggle(o.id)}
                    style={menuItem}
                  >
                    <span
                      style={{
                        width: 14,
                        flex: "none",
                        display: "inline-flex",
                        color: "var(--accent)",
                      }}
                    >
                      {on ? <Icon name="check" size={14} /> : null}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>{o.label}</span>
                  </button>
                );
              })
            )}
            {multiple && attribute.options.length > 0 ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  ...menuItem,
                  color: "var(--text-link)",
                  justifyContent: "center",
                }}
              >
                {nl.tasks.selectDone}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function TextInput({
  multiline,
  ariaLabel,
  defaultValue,
  onCommit,
}: {
  multiline: boolean;
  ariaLabel: string;
  defaultValue: string;
  onCommit: (v: string) => void;
}) {
  if (multiline) {
    return (
      <textarea
        aria-label={ariaLabel}
        defaultValue={defaultValue}
        rows={3}
        onBlur={(e) => onCommit(e.target.value)}
        style={{ ...input, height: "auto", padding: "8px 11px", resize: "vertical" }}
      />
    );
  }
  return (
    <input
      aria-label={ariaLabel}
      defaultValue={defaultValue}
      onBlur={(e) => onCommit(e.target.value)}
      style={input}
    />
  );
}

const row: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(90px, 30%) 1fr",
  gap: "9px 14px",
  alignItems: "start",
};
const label: CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: "var(--weight-semibold)",
  color: "var(--text-muted)",
  paddingTop: 8,
};
const input: CSSProperties = {
  minHeight: 34,
  border: "var(--border-width) solid var(--border-default)",
  borderRadius: "var(--radius)",
  padding: "0 11px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-body)",
  background: "var(--surface-card)",
  width: "100%",
};
const selectValueBtn: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--space-3)",
  width: "100%",
  minHeight: 34,
  border: "var(--border-width) solid var(--border-default)",
  borderRadius: "var(--radius)",
  padding: "5px 10px",
  background: "var(--surface-card)",
  fontFamily: "var(--font-sans)",
  cursor: "pointer",
  textAlign: "left",
};
const chipList: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  flex: 1,
  minWidth: 0,
};
const chip: CSSProperties = {
  display: "inline-block",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  border: "var(--border-width) solid var(--accent-tint-border)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
  borderRadius: "var(--radius-sm)",
  padding: "2px 8px",
  fontSize: "var(--text-sm)",
  fontWeight: "var(--weight-bold)",
};
const menu: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  zIndex: 40,
  minWidth: "100%",
  maxWidth: 260,
  maxHeight: 240,
  overflow: "auto",
  background: "var(--surface-card)",
  border: "var(--border-width) solid var(--border-window)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-popover)",
  padding: 6,
  display: "flex",
  flexDirection: "column",
};
const menuItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
  width: "100%",
  border: 0,
  background: "transparent",
  borderRadius: "var(--radius-sm)",
  padding: "7px 8px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-body)",
  cursor: "pointer",
  textAlign: "left",
};
const hint: CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: "var(--weight-semibold)",
  color: "var(--text-muted)",
};
