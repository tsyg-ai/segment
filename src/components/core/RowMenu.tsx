import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export interface RowMenuAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

/**
 * The "···" trigger used on a list row (sjabloonkenmerk, project, …) to tuck
 * away a row's actions (readme: delete etc. lives behind the kebab, not as an
 * always-visible link).
 *
 * The open menu is rendered in a portal at `position:fixed`, positioned from
 * the trigger's own bounding box — this is the one thing every previous,
 * bespoke `position:absolute` dropdown got wrong: an ancestor `ListCard` sets
 * `overflow:hidden` for its rounded corners, which silently clips an
 * absolutely-positioned dropdown to the row's own box. A portal never inherits
 * that clipping. Use this instead of rolling a new dropdown per screen.
 */
export function RowMenu({
  items,
  label = "Acties",
}: {
  items: RowMenuAction[];
  /** Dutch label for screen readers on the trigger button. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Any scroll or resize can move the trigger out from under the menu —
    // closing is simpler and safer than tracking a moving target.
    const onDismiss = () => setOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onDismiss, true);
    window.addEventListener("resize", onDismiss);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onDismiss, true);
      window.removeEventListener("resize", onDismiss);
    };
  }, [open]);

  const toggle = (e: ReactMouseEvent) => {
    // Rows this sits in are usually themselves clickable (open-to-edit) —
    // never let opening/closing the menu also trigger the row.
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((x) => !x);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        style={triggerBtn}
      >
        <Icon name="ellipsis" size={16} />
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              onClick={(e) => e.stopPropagation()}
              style={{ ...menuStyle, top: pos.top, right: pos.right }}
            >
              {items.map((it) => (
                <button
                  key={it.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    it.onClick();
                  }}
                  style={{
                    ...menuItemStyle,
                    color: it.danger ? "var(--late-fg)" : "var(--text-body)",
                  }}
                >
                  {it.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

const triggerBtn: CSSProperties = {
  width: 32,
  height: 32,
  flex: "none",
  border: 0,
  background: "transparent",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-muted)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
const menuStyle: CSSProperties = {
  position: "fixed",
  minWidth: 190,
  background: "var(--surface-card)",
  border: "var(--border-width) solid var(--border-window)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-popover)",
  padding: 5,
  zIndex: 80,
  display: "flex",
  flexDirection: "column",
};
const menuItemStyle: CSSProperties = {
  border: 0,
  background: "transparent",
  borderRadius: "var(--radius-sm)",
  padding: "9px 11px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-bold)",
  textAlign: "left",
  cursor: "pointer",
};
