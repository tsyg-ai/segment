import type { CSSProperties } from "react";
import { nl } from "@/i18n";
import { Button } from "@/components/core/Button";
import { SectionLabel } from "@/components/display/SectionLabel";

/**
 * Lege-toestand voor een pagina die nog geen data heeft (mockups
 * `_leeg-*`). Sjablonen / Projecten / Taken dragen een "Stap X van 3"-indicator;
 * Kenmerken en de losse gevallen krijgen "Optioneel". Titel, korte uitleg, één
 * primaire actie en een rustige hint eronder.
 */
export function OnboardingEmptyState({
  step,
  title,
  body,
  actionLabel,
  onAction,
  hint,
}: {
  /** 1–3 toont "Stap X van 3"; `"optional"` toont "Optioneel"; weglaten = niets. */
  step?: 1 | 2 | 3 | "optional";
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  hint?: string;
}) {
  const badge =
    step === "optional"
      ? nl.onboarding.optional
      : typeof step === "number"
        ? nl.onboarding.step(step)
        : null;

  return (
    <div style={wrap}>
      {badge ? <SectionLabel>{badge}</SectionLabel> : null}
      <h2 style={titleStyle}>{title}</h2>
      <p style={bodyStyle}>{body}</p>
      <div>
        <Button size="major" icon="plus" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
      {hint ? <p style={hintStyle}>{hint}</p> : null}
    </div>
  );
}

const wrap: CSSProperties = {
  maxWidth: 460,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "var(--space-5)",
  padding: "var(--space-10) 0",
};
const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "var(--text-2xl)",
  fontWeight: "var(--weight-black)",
  letterSpacing: "var(--tracking-title)",
};
const bodyStyle: CSSProperties = {
  margin: 0,
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-medium)",
  lineHeight: "var(--leading-normal)",
  color: "var(--text-secondary)",
};
const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: "var(--text-sm)",
  fontWeight: "var(--weight-semibold)",
  color: "var(--text-muted)",
};
