import type { ReactNode } from "react";
import { SectionLabel } from "@/components/display/SectionLabel";

/**
 * Placeholder body for a destination that has no feature yet. The real empty
 * states + onboarding land later — this is deliberately plain.
 */
export function EmptyState({
  label,
  message,
  children,
}: {
  label: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        padding: "var(--space-12) var(--gutter)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      <SectionLabel>{label}</SectionLabel>
      <p
        style={{
          margin: 0,
          maxWidth: 440,
          fontSize: "var(--text-md)",
          fontWeight: "var(--weight-medium)",
          lineHeight: "var(--leading-normal)",
          color: "var(--text-secondary)",
        }}
      >
        {message}
      </p>
      {children}
    </div>
  );
}
