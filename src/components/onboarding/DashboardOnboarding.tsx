import type { CSSProperties } from "react";
import { nl } from "@/i18n";
import { Button } from "@/components/core/Button";
import { Card } from "@/components/display/Card";
import { SectionLabel } from "@/components/display/SectionLabel";

const t = nl.onboarding.dashboard;

/**
 * De "clean box"-openingstoestand van het dashboard: één kaart met een korte
 * inleiding, vier genummerde uitleg-blokken — sjablonen/projecten/taken,
 * kenmerken, herinneringen, statussen — en onderaan één actie die naar de
 * sjablonen stuurt om het eerste sjabloon te maken.
 */
export function DashboardOnboarding({
  onGotoTemplates,
}: {
  onGotoTemplates: () => void;
}) {
  return (
    <Card padding={0}>
      <div style={headerBlock}>
        <SectionLabel>{t.lead}</SectionLabel>
        <span style={headerBody}>{t.body}</span>
      </div>

      <Step n={1} title={t.step1Title} body={t.step1Body} />
      <Step n={2} title={t.step2Title} body={t.step2Body} />
      <Step n={3} title={t.step3Title} body={t.step3Body} />
      <Step n={4} title={t.step4Title} body={t.step4Body} last />

      <div style={footerBlock}>
        <Button size="major" icon="plus" onClick={onGotoTemplates}>
          {t.cta}
        </Button>
      </div>
    </Card>
  );
}

// --- sub-pieces --------------------------------------------------------

function Step({
  n,
  title,
  body,
  last,
}: {
  n: number;
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <div style={{ ...rowGrid, borderBottom: last ? "none" : undefined }}>
      <span style={badge}>{n}</span>
      <span style={textCol}>
        <span style={{ ...stepTitle, color: "var(--text-secondary)" }}>{title}</span>
        <span style={stepBody}>{body}</span>
      </span>
    </div>
  );
}

// --- styles ----------------------------------------------------------

const headerBlock: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
  padding: "14px 18px 12px",
  borderBottom: "var(--border-width) solid var(--border-subtle)",
};
const headerBody: CSSProperties = {
  fontSize: "var(--text-base)",
  fontWeight: "var(--weight-semibold)",
  color: "var(--text-secondary)",
  lineHeight: 1.45,
};
const rowGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "28px minmax(0, 1fr)",
  gap: "var(--space-7)",
  alignItems: "center",
  padding: "14px 18px",
  borderBottom: "var(--border-width) solid var(--border-subtle)",
};
const badge: CSSProperties = {
  width: 28,
  height: 28,
  flex: "none",
  borderRadius: "var(--radius-round)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "var(--text-base)",
  fontWeight: "var(--weight-black)",
  background: "var(--surface-sunken)",
  color: "var(--text-muted)",
};
const textCol: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "3px",
  minWidth: 0,
};
const stepTitle: CSSProperties = {
  fontSize: "var(--text-lg)",
  fontWeight: "var(--weight-black)",
  letterSpacing: "-0.2px",
};
const stepBody: CSSProperties = {
  fontSize: "12.5px",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-muted)",
  lineHeight: 1.45,
};
const footerBlock: CSSProperties = {
  padding: "14px 18px",
  borderTop: "var(--border-width) solid var(--border-subtle)",
};
