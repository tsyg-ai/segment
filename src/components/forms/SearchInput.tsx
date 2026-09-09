import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";

/* Ported from designs/components/forms/SearchInput.jsx. */
export interface SearchInputProps {
  placeholder?: string;
  /** Keycap hint on the right. Pass null to hide. */
  shortcut?: string | null;
  value?: string;
  onChange?: (value: string) => void;
  style?: CSSProperties;
}

export function SearchInput({
  placeholder = "Zoeken…",
  shortcut = "/",
  value,
  onChange,
  style,
}: SearchInputProps) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-4)",
        background: "var(--surface-card)",
        border: "var(--border-width) solid var(--border-default)",
        borderRadius: "var(--radius)",
        padding: "0 13px",
        height: "var(--control-h)",
        flex: "0 1 212px",
        minWidth: "110px",
        ...style,
      }}
    >
      <Icon name="search" size={15} style={{ color: "#A7B0AA" }} />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        style={{
          border: 0,
          outline: 0,
          background: "transparent",
          width: "100%",
          minWidth: 0,
          fontSize: "14.5px",
          fontWeight: "var(--weight-semibold)",
          color: "var(--text-primary)",
        }}
      />
      {shortcut ? (
        <span
          style={{
            fontSize: "11.5px",
            fontWeight: "var(--weight-bold)",
            color: "#A7B0AA",
            flex: "none",
            border: "var(--border-width) solid var(--border-default)",
            borderRadius: "var(--radius-sm)",
            padding: "1px 6px",
          }}
        >
          {shortcut}
        </span>
      ) : null}
    </label>
  );
}
