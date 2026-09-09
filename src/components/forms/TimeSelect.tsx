import { useMemo, useState, type CSSProperties } from "react";
import { nl } from "@/i18n";
import { Icon } from "@/components/core/Icon";

/* 24h kwartier-tijdkiezer als dropdown — dezelfde look & feel als het
   deadlineveld in het taakdetailpaneel. `value`/`onChange` blijven "HH:MM"
   (of "" als er geen tijdstip is). Een waarde buiten het kwartierraster wordt
   toegevoegd zodat ze zichtbaar blijft. */

/** 24-uurs tijdstippen in kwartieren — geen AM/PM, ongeacht de systeemtaal. */
export const TIME_OPTIONS: string[] = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = Math.floor(i / 4);
  const min = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
});

export interface TimeSelectProps {
  /** "HH:MM" (24h), of "" als er geen tijdstip is. */
  value: string;
  onChange: (time: string) => void;
  disabled?: boolean;
  /** Op de trigger-knop toegepast (breedte, rand, …). */
  style?: CSSProperties;
  "aria-label"?: string;
}

export function TimeSelect({
  value,
  onChange,
  disabled,
  style,
  "aria-label": ariaLabel,
}: TimeSelectProps) {
  const [open, setOpen] = useState(false);
  const options = useMemo(
    () =>
      value && !TIME_OPTIONS.includes(value)
        ? [...TIME_OPTIONS, value].sort()
        : TIME_OPTIONS,
    [value],
  );

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((x) => !x)}
        style={{
          ...trigger,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          ...style,
        }}
      >
        <Icon name="clock" size={13} />
        <span
          style={{
            flex: 1,
            textAlign: "left",
            color: value ? "var(--text-body)" : "var(--text-muted)",
          }}
        >
          {value || nl.tasks.deadlineTime}
        </span>
        <Icon name="chevron-down" size={13} />
      </button>

      {open && !disabled ? (
        <>
          <div
            role="presentation"
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 39 }}
          />
          <div
            style={menu}
            role="listbox"
            aria-label={ariaLabel ?? nl.tasks.deadlineTime}
          >
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              style={menuItem}
            >
              <span style={{ flex: 1, minWidth: 0, color: "var(--text-muted)" }}>
                {nl.tasks.deadlineTimeNone}
              </span>
              {!value ? (
                <Icon name="check" size={14} style={{ color: "var(--accent)" }} />
              ) : null}
            </button>
            {options.map((o) => (
              <button
                key={o}
                type="button"
                role="option"
                aria-selected={o === value}
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                style={menuItem}
              >
                <span style={{ flex: 1, minWidth: 0 }}>{o}</span>
                {o === value ? (
                  <Icon name="check" size={14} style={{ color: "var(--accent)" }} />
                ) : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

const trigger: CSSProperties = {
  minHeight: 34,
  display: "flex",
  alignItems: "center",
  gap: 6,
  width: 132,
  border: "var(--border-width) solid var(--border-hover)",
  outline: "none",
  borderRadius: 8,
  padding: "0 10px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-body)",
  background: "var(--surface-card)",
};
const menu: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  zIndex: 40,
  minWidth: 132,
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
  gap: "var(--space-4)",
  width: "100%",
  border: 0,
  background: "transparent",
  borderRadius: "var(--radius-sm)",
  padding: "8px 10px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-body)",
  cursor: "pointer",
  textAlign: "left",
};
