import type { ReactNode } from "react";
import { Icon } from "../core/Icon";
import { tintFromHex } from "@/lib/colorTint";

/* Ported from designs/components/display/StatusPill.jsx. The three tones map to
   the user's own statuses; the defaults are Te doen / Bezig / Klaar. */

const STATUS_TONES = {
  todo: {
    color: "var(--text-secondary)",
    background: "var(--surface-sunken)",
    border: "var(--border-width) solid var(--border-default)",
  },
  busy: {
    color: "var(--today-fg)",
    background: "var(--today-bg)",
    border: "var(--border-width) solid var(--today-border)",
  },
  done: {
    color: "var(--accent-text)",
    background: "var(--accent-tint)",
    border: "var(--border-width) solid var(--accent-tint-border)",
  },
} as const;

export type StatusTone = keyof typeof STATUS_TONES;

export interface StatusPillProps {
  /** Maps to the user's statuses; defaults are Te doen / Bezig / Klaar. */
  status?: StatusTone;
  /** The status name, verbatim from the user's own status list. */
  children?: ReactNode;
  /** xs = 30px in list rows, md = 36px in the detail panel. */
  size?: "xs" | "md";
  /**
   * De eigen kleur van de actieve status (hex uit `status.color`). Wint van
   * `status`: de pill draagt de kleur van de status die op dat moment geldt,
   * zodat de gebruiker zijn eigen ramp overal terugziet. Valt terug op de
   * tooltinten wanneer de waarde geen hex is.
   */
  color?: string | null;
  onClick?: () => void;
}

export function StatusPill({
  status = "todo",
  children,
  size = "xs",
  color,
  onClick,
}: StatusPillProps) {
  const tint = tintFromHex(color);
  const t = tint
    ? {
        color: tint.color,
        background: tint.background,
        border: `var(--border-width) solid ${tint.borderColor}`,
      }
    : (STATUS_TONES[status] ?? STATUS_TONES.todo);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={{
        height: size === "md" ? "var(--control-h-md)" : "var(--control-h-xs)",
        padding: "0 var(--control-pad-x-sm)",
        fontFamily: "var(--font-sans)",
        fontSize: size === "md" ? "var(--text-md)" : "var(--text-xs)",
        fontWeight: "var(--weight-black)",
        borderRadius: "var(--radius)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        transition: "var(--transition)",
        ...t,
      }}
    >
      {children}
      <Icon name="chevron-down" size={13} />
    </button>
  );
}
