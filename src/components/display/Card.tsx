import type { CSSProperties, ReactNode } from "react";

/* Ported from designs/components/display/Card.jsx. White, hairline border, one
   elevation level; overflow hidden so rows sit flush. Cards never nest. */
export interface CardProps {
  children?: ReactNode;
  /** Rows sit flush (0); free content uses 14–18px. */
  padding?: number | string;
  style?: CSSProperties;
}

export function Card({ children, padding = 0, style }: CardProps) {
  return (
    <div
      style={{
        background: "var(--surface-card)",
        border: "var(--border-width) solid var(--border-default)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-card)",
        overflow: "hidden",
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
