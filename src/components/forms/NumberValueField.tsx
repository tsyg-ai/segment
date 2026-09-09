import { useState, type CSSProperties } from "react";
import { nl } from "@/i18n";
import { formatNumber } from "@/i18n/format";

/* Het invulveld voor een getal-kenmerk — op een taak én op een sjabloon.
   Eén regel voor alle getalvelden: de komma is het decimaalteken, een punt
   wordt geweigerd, en verder is elke waarde goed (geen vast aantal
   decimalen). Wat niet als getal leest, wordt niet weggeschreven; het blijft
   staan met een melding eronder. */

/** Wat een ingetikt getal oplevert: een waarde (`null` bij een leeg veld), of
 *  een melding om onder het veld te tonen. */
export type NumberParse = { value: number | null } | { error: string };

/** Lees een ingetikt getal volgens de regel hierboven. */
export function parseNumberInput(raw: string): NumberParse {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: null };
  if (trimmed.includes(".")) return { error: nl.tasks.numberDotError };
  const n = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(n)) return { error: nl.tasks.numberInvalid };
  return { value: n };
}

export function NumberValueField({
  value,
  unit,
  ariaLabel,
  style,
  onCommit,
}: {
  value: number | null | undefined;
  /** Vaste suffix achter het veld; wordt niet meegetypt. */
  unit?: string | null;
  ariaLabel: string;
  /** Op het invoerveld zelf toegepast (breedte, hoogte, …). */
  style?: CSSProperties;
  onCommit: (value: number | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <input
          inputMode="decimal"
          aria-label={ariaLabel}
          defaultValue={value != null ? formatNumber(value) : ""}
          // Tijdens het typen alleen de punt aanstippen: "-" of "1," is nog
          // geen getal, maar wel onderweg naar er een.
          onChange={(e) =>
            setError(e.target.value.includes(".") ? nl.tasks.numberDotError : null)
          }
          onBlur={(e) => {
            const parsed = parseNumberInput(e.target.value);
            if ("error" in parsed) {
              setError(parsed.error);
              return;
            }
            setError(null);
            onCommit(parsed.value);
          }}
          style={style}
        />
        {unit ? (
          <span
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-secondary)",
            }}
          >
            {unit}
          </span>
        ) : null}
      </div>
      {error ? (
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: "var(--weight-semibold)",
            color: "var(--late-fg)",
          }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
