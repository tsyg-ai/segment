import { Icon } from "./Icon";

/* Ported from designs/components/core/Checkbox.jsx. */
export interface CheckboxProps {
  checked?: boolean;
  onChange?: () => void;
  /** Dutch label for screen readers, e.g. "Taak selecteren". */
  label?: string;
}

export function Checkbox({ checked = false, onChange, label }: CheckboxProps) {
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.();
      }}
      style={{
        width: "var(--checkbox-size)",
        height: "var(--checkbox-size)",
        flex: "none",
        borderRadius: "var(--radius-sm)",
        background: checked ? "var(--accent)" : "transparent",
        border: checked ? "0" : "var(--border-width-control) solid var(--ink-100)",
        color: "var(--text-on-dark)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "var(--transition)",
      }}
    >
      {checked ? <Icon name="check" size={14} /> : null}
    </span>
  );
}
