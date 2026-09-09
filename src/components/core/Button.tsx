import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/* Ported from designs/components/core/Button.jsx. One size for every button;
   only colour differs. `major` is the single screen-level primary action. */

const SIZES = {
  standard: {
    height: "var(--control-h-sm)",
    font: "var(--text-base)",
    padX: "var(--control-pad-x-sm)",
  },
  major: {
    height: "var(--control-h)",
    font: "var(--text-lg)",
    padX: "var(--control-pad-x)",
  },
} as const;

const VARIANTS = {
  primary: { background: "var(--accent)", color: "var(--text-on-dark)", border: "0" },
  secondary: {
    background: "var(--surface-card)",
    color: "var(--text-body)",
    border: "var(--border-width) solid var(--border-default)",
  },
  tinted: {
    background: "var(--accent-tint)",
    color: "var(--accent-text)",
    border: "var(--border-width) solid var(--accent-tint-border)",
  },
  toolbar: {
    background: "var(--surface-toolbar-control)",
    color: "var(--text-on-dark)",
    border: "0",
  },
  ghost: { background: "transparent", color: "var(--text-secondary)", border: "0" },
  danger: {
    background: "var(--surface-toolbar-control)",
    color: "var(--danger-on-dark-fg)",
    border: "0",
  },
  dashed: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "var(--border-width-control) dashed var(--border-dashed)",
  },
} as const;

export interface ButtonProps {
  /** Visual treatment. `toolbar`/`danger` are for the dark bulk bar only. */
  variant?: keyof typeof VARIANTS;
  /** standard = 32px (alles), major = 42px (hoofdactie van het scherm, max. 1) */
  size?: keyof typeof SIZES;
  /** Leading Lucide glyph, e.g. "plus". */
  icon?: IconName;
  /** Trailing Lucide glyph, always 13px — the keuzelijst chevron. */
  iconEnd?: IconName;
  children?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  style?: CSSProperties;
}

export function Button({
  variant = "primary",
  size = "standard",
  icon,
  iconEnd,
  children,
  disabled,
  onClick,
  type = "button",
  style,
}: ButtonProps) {
  const s = SIZES[size] ?? SIZES.standard;
  const v = VARIANTS[variant] ?? VARIANTS.primary;
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        height: s.height,
        padding: `0 ${s.padX}`,
        fontSize: s.font,
        fontWeight: "var(--weight-bold)",
        fontFamily: "var(--font-sans)",
        background: v.background,
        color: v.color,
        border: v.border,
        borderRadius: "var(--radius)",
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-4)",
        whiteSpace: "nowrap",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "var(--transition)",
        ...style,
      }}
    >
      {icon ? <Icon name={icon} size={size === "major" ? 18 : 15} /> : null}
      {children}
      {iconEnd ? <Icon name={iconEnd} size={13} /> : null}
    </button>
  );
}
