import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

/* Locale-independent time field. The native <input type="time"> shows an AM/PM
   clock on 12-hour locales; Belgium uses a 24-hour clock, so this is a plain
   text input fixed to HH:MM (24h). `value`/`onChange` stay in "HH:MM" (or ""). */

/** Normalise loose input to 24h "HH:MM". Accepts "h", "h:m", "hhmm", "hmm".
 *  Returns "" when empty or out of range. */
export function displayToIsoTime(text: string): string {
  const trimmed = text.trim();
  if (trimmed === "") return "";

  let h: number, m: number;
  if (trimmed.includes(":")) {
    const [hs, ms = "0"] = trimmed.split(":");
    h = Number(hs);
    m = Number(ms);
  } else {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length <= 2) {
      h = Number(digits);
      m = 0;
    } else {
      h = Number(digits.slice(0, digits.length - 2));
      m = Number(digits.slice(-2));
    }
  }

  if (!Number.isInteger(h) || !Number.isInteger(m)) return "";
  if (h < 0 || h > 23 || m < 0 || m > 59) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}`;
}

export interface TimeFieldProps {
  /** "HH:MM" (24h), or "" for empty. */
  value: string;
  /** Fires on blur / Enter with a valid "HH:MM" or "" (cleared). */
  onChange: (time: string) => void;
  disabled?: boolean;
  style?: CSSProperties;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

export function TimeField({
  value,
  onChange,
  disabled,
  style,
  id,
  className,
  "aria-label": ariaLabel,
}: TimeFieldProps) {
  const [text, setText] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);

  const commit = () => {
    if (text.trim() === "") {
      if (value !== "") onChange("");
      setText("");
      return;
    }
    const next = displayToIsoTime(text);
    if (next === "") {
      setText(value); // revert to last valid
      return;
    }
    if (next !== value) onChange(next);
    setText(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      id={id}
      className={className}
      aria-label={ariaLabel}
      placeholder="uu:mm"
      disabled={disabled}
      value={text}
      onChange={(e) => setText(e.target.value.replace(/[^\d:]/g, ""))}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onKeyDown={onKeyDown}
      style={style}
    />
  );
}
