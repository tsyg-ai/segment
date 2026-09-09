import { nl } from "@/i18n";

/**
 * The footer bar every task view ends in (readme: identical wording across
 * Lijst / Tabel / Kanban / Kalender). `flex:none` — only the list scrolls.
 * Counts are placeholders until the views land.
 */
export function FooterBar({
  shown = 0,
  total = 0,
  late = 0,
  onClear,
}: {
  shown?: number;
  total?: number;
  late?: number;
  onClear?: () => void;
}) {
  return (
    <footer
      style={{
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-8)",
        padding: "var(--space-5) var(--gutter)",
        borderTop: "var(--border-width) solid var(--border-default)",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--weight-bold)",
        color: "var(--text-secondary)",
        whiteSpace: "nowrap",
      }}
    >
      <span>{nl.footer.visible(shown, total)}</span>
      <span style={{ color: late > 0 ? "var(--late-fg)" : "var(--text-muted)" }}>
        {nl.footer.late(late)}
      </span>
      <div style={{ flex: 1 }} />
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onClear?.();
        }}
        style={{ fontWeight: "var(--weight-bold)" }}
      >
        {nl.footer.clearFilterSort}
      </a>
    </footer>
  );
}
