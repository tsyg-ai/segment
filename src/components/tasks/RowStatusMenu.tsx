import { useEffect, useRef, useState, type CSSProperties } from "react";
import { nl } from "@/i18n";
import type { Status } from "@/lib/statusTypes";
import type { statusTone } from "@/lib/taskDisplay";
import { Icon } from "@/components/core/Icon";
import { StatusPill } from "@/components/display/StatusPill";
import { tintFromHex } from "@/lib/colorTint";

/**
 * De status-pill in een takenrij: klikken opent een keuzelijst met **alle**
 * statussen i.p.v. door te schuiven. Het menu zweeft `position: fixed` t.o.v. de
 * pill zodat de `overflow: hidden` van de omliggende kaart het niet afknipt.
 * Gedeeld door de lijst-view en de projectpagina.
 */
export function RowStatusMenu({
  statuses,
  value,
  tone,
  label,
  color,
  onPick,
}: {
  statuses: Status[];
  value: number;
  tone: ReturnType<typeof statusTone>;
  label: string;
  /** Hex van de actieve status — kleurt de pill. */
  color?: string | null;
  onPick: (statusId: number) => void;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!anchor) return;
    const close = () => setAnchor(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [anchor]);

  const toggle = () => {
    if (anchor) {
      setAnchor(null);
      return;
    }
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) setAnchor(r);
  };

  const estHeight = Math.min(statuses.length, 8) * 40 + 12;
  const flipUp =
    anchor != null &&
    anchor.bottom + 6 + estHeight > window.innerHeight &&
    anchor.top - estHeight - 6 > 0;

  return (
    <span
      ref={wrapRef}
      style={{ position: "relative", display: "inline-flex" }}
      onClick={(e) => e.stopPropagation()}
    >
      <StatusPill status={tone} color={color} onClick={toggle}>
        {label}
      </StatusPill>
      {anchor ? (
        <>
          <div
            role="presentation"
            onClick={() => setAnchor(null)}
            style={{ position: "fixed", inset: 0, zIndex: 49 }}
          />
          <div
            role="listbox"
            aria-label={nl.tasks.statusLabel}
            style={{
              position: "fixed",
              top: flipUp ? anchor.top - estHeight - 6 : anchor.bottom + 6,
              right: Math.max(8, window.innerWidth - anchor.right),
              zIndex: 50,
              minWidth: 200,
              maxHeight: 320,
              overflowY: "auto",
              background: "var(--surface-card)",
              border: "var(--border-width) solid var(--border-window)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow-popover)",
              padding: 6,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {statuses.map((s) => {
              const tint = s.id === value ? tintFromHex(s.color) : null;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={s.id === value}
                  onClick={() => {
                    onPick(s.id);
                    setAnchor(null);
                  }}
                  style={
                    tint
                      ? {
                          ...statusMenuItem,
                          background: tint.background,
                          color: tint.color,
                        }
                      : statusMenuItem
                  }
                >
                  <span
                    style={{
                      width: "var(--dot-size)",
                      height: "var(--dot-size)",
                      borderRadius: "var(--radius-round)",
                      background: s.color,
                      flex: "none",
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>{s.name}</span>
                  {s.id === value ? (
                    <Icon
                      name="check"
                      size={14}
                      style={{ color: tint?.color ?? "var(--accent)" }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </span>
  );
}

const statusMenuItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-4)",
  width: "100%",
  border: 0,
  background: "transparent",
  borderRadius: "var(--radius-sm)",
  padding: "8px 10px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-body)",
  cursor: "pointer",
  textAlign: "left",
};
