import type { CSSProperties, ReactNode } from "react";

/* Ported from designs/components/display/SectionLabel.jsx. The only uppercase
   text in the system (11px). */
export interface SectionLabelProps {
  children?: ReactNode;
  style?: CSSProperties;
}

export function SectionLabel({ children, style }: SectionLabelProps) {
  return (
    <span
      style={{
        fontSize: "var(--label-size)",
        fontWeight: "var(--label-weight)",
        letterSpacing: "var(--label-tracking)",
        textTransform: "uppercase",
        color: "var(--label-color)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
