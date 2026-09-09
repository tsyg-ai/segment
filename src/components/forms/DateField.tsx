import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { DayPicker } from "react-day-picker";
import { nlBE } from "date-fns/locale";
import "react-day-picker/style.css";
import "./DateField.css";
import { Icon } from "@/components/core/Icon";

/* Locale-independent date field. The native <input type="date"> renders in the
   host OS / WebView locale (MM/DD/YYYY on a US machine), which we can't control,
   so this is a plain text input that always shows and accepts the Belgian
   DD/MM/YYYY format, paired with a react-day-picker calendar popover.
   `value`/`onChange` stay in ISO "YYYY-MM-DD" (or ""). */

/** ISO "YYYY-MM-DD" -> "DD/MM/YYYY". Anything else -> "". */
export function isoToDisplayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/**
 * Parse a Belgian-format date into ISO "YYYY-MM-DD". Accepts "d/m/yyyy",
 * "dd/mm/yyyy", 2-digit years ("d/m/yy" -> 20yy) and 8 bare digits
 * ("ddmmyyyy"). Returns "" when the input is incomplete or not a real date.
 */
export function displayToIsoDate(text: string): string {
  const trimmed = text.trim();
  if (trimmed === "") return "";

  let d: number, mo: number, y: number;
  const parts = trimmed.split("/");
  if (parts.length === 3 && parts.every((p) => p.trim() !== "")) {
    d = Number(parts[0]);
    mo = Number(parts[1]);
    y = Number(parts[2]);
    if (parts[2].trim().length <= 2) y += 2000;
  } else {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length !== 8) return "";
    d = Number(digits.slice(0, 2));
    mo = Number(digits.slice(2, 4));
    y = Number(digits.slice(4));
  }

  if (!Number.isInteger(d) || !Number.isInteger(mo) || !Number.isInteger(y)) return "";
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return "";
  }
  return isoFromParts(y, mo, d);
}

function isoFromParts(y: number, mo: number, d: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p(mo)}-${p(d)}`;
}

/** ISO "YYYY-MM-DD" -> local `Date` (midnight), or undefined. */
function isoToDate(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Local `Date` -> ISO "YYYY-MM-DD" (no UTC shift). */
function dateToIso(d: Date): string {
  return isoFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Progressive DD/MM/YYYY mask: keep digits, drop slashes after 2 and 4. */
function mask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const out: string[] = [digits.slice(0, 2)];
  if (digits.length > 2) out.push(digits.slice(2, 4));
  if (digits.length > 4) out.push(digits.slice(4, 8));
  return out.join("/");
}

export interface DateFieldProps {
  /** ISO "YYYY-MM-DD", or "" for empty. */
  value: string;
  /** Fires on blur / Enter / calendar pick with a valid ISO date or "" (cleared). */
  onChange: (iso: string) => void;
  disabled?: boolean;
  style?: CSSProperties;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

export function DateField({
  value,
  onChange,
  disabled,
  style,
  id,
  className,
  "aria-label": ariaLabel,
}: DateFieldProps) {
  const [text, setText] = useState(() => isoToDisplayDate(value));
  const [open, setOpen] = useState(false);
  const focused = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();

  // Popover placement — flips to right-aligned / above when the default
  // below-and-left position would overflow the viewport (e.g. the narrow task
  // detail panel).
  const [placement, setPlacement] = useState<{
    x: "left" | "right";
    y: "top" | "bottom";
  }>({ x: "left", y: "bottom" });

  // Resync from outside only while not being edited.
  useEffect(() => {
    if (!focused.current) setText(isoToDisplayDate(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPlacement({ x: "left", y: "bottom" });
      return;
    }
    const el = dialogRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    setPlacement({
      x: r.right > window.innerWidth - pad ? "right" : "left",
      y: r.bottom > window.innerHeight - pad ? "top" : "bottom",
    });
  }, [open]);

  const commit = () => {
    if (text.trim() === "") {
      if (value !== "") onChange("");
      setText("");
      return;
    }
    const iso = displayToIsoDate(text);
    if (iso === "") {
      setText(isoToDisplayDate(value)); // revert to last valid
      return;
    }
    if (iso !== value) onChange(iso);
    setText(isoToDisplayDate(iso));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const selected = isoToDate(value);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        opacity: disabled ? 0.5 : undefined,
        ...style,
      }}
    >
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        id={id}
        aria-label={ariaLabel}
        placeholder="dd/mm/jjjj"
        disabled={disabled}
        value={text}
        onChange={(e) => setText(mask(e.target.value))}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          commit();
        }}
        onKeyDown={onKeyDown}
        style={{
          flex: 1,
          minWidth: 0,
          width: "100%",
          border: 0,
          outline: 0,
          padding: 0,
          margin: 0,
          background: "transparent",
          font: "inherit",
          color: "inherit",
          textAlign: "inherit",
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Kalender openen"
        onClick={() => setOpen((o) => !o)}
        style={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: 0,
          background: "transparent",
          padding: 2,
          margin: 0,
          cursor: disabled ? "not-allowed" : "pointer",
          color: "var(--text-muted)",
        }}
      >
        <Icon name="calendar" size={14} />
      </button>

      {open && !disabled ? (
        <>
          <div
            role="presentation"
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 39 }}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-label={ariaLabel}
            id={dialogId}
            style={{
              position: "absolute",
              top: placement.y === "bottom" ? "calc(100% + 6px)" : undefined,
              bottom: placement.y === "top" ? "calc(100% + 6px)" : undefined,
              left: placement.x === "left" ? 0 : undefined,
              right: placement.x === "right" ? 0 : undefined,
              zIndex: 40,
              background: "var(--surface-card)",
              border: "var(--border-width) solid var(--border-window)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow-popover)",
              padding: 8,
            }}
          >
            <DayPicker
              className="datefield-calendar"
              mode="single"
              locale={nlBE}
              weekStartsOn={1}
              showOutsideDays
              selected={selected}
              defaultMonth={selected}
              onSelect={(day) => {
                if (day) {
                  const iso = dateToIso(day);
                  if (iso !== value) onChange(iso);
                  setText(isoToDisplayDate(iso));
                }
                setOpen(false);
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
