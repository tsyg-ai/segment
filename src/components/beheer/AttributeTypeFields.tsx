import { useState, type CSSProperties } from "react";
import { nl } from "@/i18n";
import { formatNumber } from "@/i18n/format";
import { parseNumberInput } from "@/components/forms/NumberValueField";
import type { AttributeType } from "@/lib/beheerTypes";
import { SectionLabel } from "@/components/display/SectionLabel";

/** The type-specific instelvelden (spec §4). Renders **only** what the chosen
 *  type needs; every other type's fields are absent from the DOM. */
export interface AttributeTypeValues {
  selectMultiple: boolean;
  textMultiline: boolean;
  numberUnit: string;
  checkboxDefault: boolean;
}

export function AttributeTypeFields({
  type,
  values,
  onChange,
}: {
  type: AttributeType;
  values: AttributeTypeValues;
  onChange: (patch: Partial<AttributeTypeValues>) => void;
}) {
  if (type === "text") {
    return (
      <FieldGroup label={nl.attributes.lengthLabel} help={nl.attributes.lengthHelp}>
        <PillToggle
          options={[
            { value: false, label: nl.attributes.lengthSingle },
            { value: true, label: nl.attributes.lengthMulti },
          ]}
          value={values.textMultiline}
          onChange={(v) => onChange({ textMultiline: v })}
        />
      </FieldGroup>
    );
  }

  if (type === "number") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-9)" }}>
        <FieldGroup label={nl.attributes.unitLabel} hint={nl.attributes.unitOptional}>
          <input
            value={values.numberUnit}
            onChange={(e) => onChange({ numberUnit: e.target.value })}
            placeholder={nl.attributes.unitPlaceholder}
            style={textInput}
          />
        </FieldGroup>
        <NumberPreview unit={values.numberUnit} />
      </div>
    );
  }

  if (type === "date") {
    return (
      <FieldGroup label={nl.attributes.dateNothing} help={nl.attributes.dateHelp}>
        <span
          style={{
            fontSize: "var(--text-md)",
            fontWeight: "var(--weight-bold)",
            color: "var(--text-secondary)",
          }}
        >
          do 4 sep · 14:30
        </span>
      </FieldGroup>
    );
  }

  if (type === "checkbox") {
    return (
      <FieldGroup label={nl.attributes.checkboxLabel} help={nl.attributes.checkboxHelp}>
        <PillToggle
          options={[
            { value: false, label: nl.attributes.checkboxEmpty },
            { value: true, label: nl.attributes.checkboxChecked },
          ]}
          value={values.checkboxDefault}
          onChange={(v) => onChange({ checkboxDefault: v })}
        />
      </FieldGroup>
    );
  }

  // select
  return (
    <FieldGroup label={nl.attributes.selectionLabel}>
      <PillToggle
        options={[
          { value: false, label: nl.attributes.selectionSingle },
          { value: true, label: nl.attributes.selectionMultiple },
        ]}
        value={values.selectMultiple}
        onChange={(v) => onChange({ selectMultiple: v })}
      />
    </FieldGroup>
  );
}

function NumberPreview({ unit }: { unit: string }) {
  const [raw, setRaw] = useState("1,5");
  const parsed = parseNumberInput(raw);
  const error = "error" in parsed ? parsed.error : null;
  const value = "error" in parsed ? null : parsed.value;
  return (
    <FieldGroup label={nl.attributes.previewLabel}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)" }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            border: "var(--border-width) solid var(--border-hover)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 11px",
            background: "var(--surface-card)",
          }}
        >
          <input
            aria-label={nl.attributes.previewLabel}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            style={{
              width: 56,
              border: 0,
              outline: 0,
              background: "transparent",
              fontSize: "var(--text-base)",
              fontWeight: "var(--weight-bold)",
              color: "var(--text-body)",
            }}
          />
          {unit.trim() ? (
            <span
              style={{
                fontSize: "var(--text-base)",
                fontWeight: "var(--weight-bold)",
                color: "var(--text-muted)",
              }}
            >
              {unit.trim()}
            </span>
          ) : null}
        </label>
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: "var(--weight-bold)",
            color: error ? "var(--late-fg)" : "var(--text-muted)",
            lineHeight: "var(--leading-snug)",
          }}
        >
          {error
            ? error
            : value != null
              ? `${formatNumber(value)}${unit.trim() ? " " + unit.trim() : ""} — ${nl.attributes.unitHelp}`
              : nl.attributes.unitHelp}
        </span>
      </div>
    </FieldGroup>
  );
}

const textInput: CSSProperties = {
  height: 38,
  border: "var(--border-width) solid var(--border-default)",
  borderRadius: "var(--radius)",
  padding: "0 13px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-body)",
  background: "var(--surface-card)",
  width: "100%",
};

function FieldGroup({
  label,
  hint,
  help,
  children,
}: {
  label: string;
  hint?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        <SectionLabel>{label}</SectionLabel>
        {hint ? (
          <span
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: "var(--weight-bold)",
              color: "var(--text-label)",
            }}
          >
            {hint}
          </span>
        ) : null}
      </div>
      {children}
      {help ? (
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: "var(--weight-semibold)",
            color: "var(--text-muted)",
            lineHeight: "var(--leading-snug)",
          }}
        >
          {help}
        </span>
      ) : null}
    </div>
  );
}

export function PillToggle<T extends string | number | boolean>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: "var(--space-4)" }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            style={{
              height: 38,
              padding: "0 15px",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-base)",
              fontWeight: active ? "var(--weight-black)" : "var(--weight-bold)",
              borderRadius: "var(--radius)",
              cursor: "pointer",
              background: active ? "var(--accent-tint)" : "var(--surface-card)",
              color: active ? "var(--accent-text)" : "var(--text-body)",
              border: active
                ? "var(--border-width) solid var(--accent)"
                : "var(--border-width) solid var(--border-default)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
