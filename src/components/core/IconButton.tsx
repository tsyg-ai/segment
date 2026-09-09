import { Icon, type IconName } from "./Icon";

/* Ported from designs/components/core/IconButton.jsx. */
export interface IconButtonProps {
  /** Lucide icon name; "x" closes a panel, "ellipsis" opens overflow. */
  icon?: IconName;
  /** Dutch label for screen readers, e.g. "Paneel sluiten". Always set it: there is no text. */
  label?: string;
  onClick?: () => void;
  /** Square size in px, default 32. */
  size?: number;
}

export function IconButton({ icon = "x", label, onClick, size = 32 }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        flex: "none",
        border: 0,
        background: "#EFEBE1",
        color: "var(--text-secondary)",
        borderRadius: "var(--radius-sm)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "var(--transition)",
      }}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}
