import type { ReactNode } from "react";

/* Ported from designs/components/tasks/NavItem.jsx. The sidebar is text: no
   icons, no counts. Active item is white with a teal label and a raised shadow. */
export interface NavItemProps {
  children?: ReactNode;
  active?: boolean;
  /** Usually a <Badge> — unused in the sidebar (labels only). */
  trailing?: ReactNode;
  onClick?: () => void;
}

export function NavItem({ children, active = false, trailing, onClick }: NavItemProps) {
  return (
    <a
      href="#"
      aria-current={active ? "page" : undefined}
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-4)",
        padding: "10px 12px",
        borderRadius: "var(--radius)",
        textDecoration: "none",
        fontSize: "var(--text-lg)",
        fontWeight: active ? "var(--weight-bold)" : "var(--weight-semibold)",
        color: active ? "var(--accent-text)" : "var(--text-body)",
        background: active ? "var(--surface-card)" : "transparent",
        boxShadow: active ? "var(--shadow-raised)" : "none",
      }}
    >
      <span>{children}</span>
      {trailing}
    </a>
  );
}
