import type { CSSProperties, ReactNode } from "react";
import { nl } from "@/i18n";
import { Button } from "@/components/core/Button";
import { Card } from "@/components/display/Card";
import { SectionLabel } from "@/components/display/SectionLabel";

const t = nl.onboarding.dashboard;

/**
 * De "clean box"-openingstoestand van het dashboard (mockup
 * `_leeg-dashboard`): één kaart met een korte inleiding, de drie genummerde
 * stappen Sjablonen → Projecten → Taken (alleen stap 1 heeft een actie) en
 * daaronder twee optionele rijen — Kenmerken en Statussen.
 */
export function DashboardOnboarding({
  onGotoTemplates,
  onGotoAttributes,
  onGotoStatuses,
}: {
  onGotoTemplates: () => void;
  onGotoAttributes: () => void;
  onGotoStatuses: () => void;
}) {
  return (
    <Card padding={0}>
      <div style={headerBlock}>
        <SectionLabel>{t.lead}</SectionLabel>
        <span style={headerBody}>{t.body}</span>
      </div>

      <Step n={1} active title={t.step1Title} body={t.step1Body}>
        <Button size="major" icon="plus" onClick={onGotoTemplates}>
          {t.step1Action}
        </Button>
      </Step>
      <Step n={2} title={t.step2Title} body={t.step2Body} />
      <Step n={3} title={t.step3Title} body={t.step3Body} />

      <OptionalStep
        title={t.optionalAttrTitle}
        body={t.optionalAttrBody}
        actionLabel={t.optionalAttrAction}
        onAction={onGotoAttributes}
      />
      <OptionalStep
        divided
        title={t.optionalStatusTitle}
        body={t.optionalStatusBody}
        actionLabel={t.optionalStatusAction}
        onAction={onGotoStatuses}
      />
    </Card>
  );
}

// --- sub-pieces --------------------------------------------------------

function Step({
  n,
  active,
  title,
  body,
  children,
}: {
  n: number;
  active?: boolean;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div style={rowGrid}>
      <span style={{ ...badge, ...(active ? badgeActive : badgeIdle) }}>{n}</span>
      <span style={textCol}>
        <span
          style={{
            ...stepTitle,
            color: active ? "var(--text-primary)" : "var(--text-secondary)",
          }}
        >
          {title}
        </span>
        <span style={stepBody}>{body}</span>
      </span>
      <span>{children}</span>
    </div>
  );
}

function OptionalStep({
  divided,
  title,
  body,
  actionLabel,
  onAction,
}: {
  divided?: boolean;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div
      style={{
        ...rowGrid,
        background: "var(--surface-panel)",
        borderBottom: "none",
        borderTop: divided
          ? "var(--border-width) solid var(--border-subtle)"
          : undefined,
      }}
    >
      <span style={{ ...badge, ...badgeIdle, fontSize: "var(--text-lg)" }}>+</span>
      <span style={textCol}>
        <span style={optionalTitleRow}>
          <span style={{ ...stepTitle, color: "var(--text-secondary)" }}>{title}</span>
          <span style={optionalPill}>{nl.onboarding.optional}</span>
        </span>
        <span style={stepBody}>{body}</span>
      </span>
      <Button size="major" variant="secondary" onClick={onAction}>
        {actionLabel}
      </Button>
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
  gridTemplateColumns: "28px minmax(0, 1fr) auto",
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
};
const badgeActive: CSSProperties = {
  background: "var(--accent)",
  color: "var(--text-on-dark)",
};
const badgeIdle: CSSProperties = {
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
const optionalTitleRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-4)",
  minWidth: 0,
};
const optionalPill: CSSProperties = {
  flex: "none",
  fontSize: "10.5px",
  fontWeight: "var(--weight-bold)",
  letterSpacing: "0.6px",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  background: "var(--surface-sunken)",
  borderRadius: "var(--radius-round)",
  padding: "3px 8px",
};
