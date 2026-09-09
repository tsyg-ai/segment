import { useState, type CSSProperties, type ReactNode } from "react";
import { nl } from "@/i18n";
import {
  formatFullDate,
  formatShortDate,
  formatShortDateTime,
  formatTime,
  parseLocalDateTime,
} from "@/i18n/format";
import { useDashboard, useMarkSeen, useOnboarding } from "@/lib/dashboardQueries";
import type { DashboardDeadline, DashboardReminder } from "@/lib/dashboardTypes";
import { ViewHeader } from "@/views/ViewHeader";
import { Button } from "@/components/core/Button";
import { Icon } from "@/components/core/Icon";
import { Card } from "@/components/display/Card";
import { SectionLabel } from "@/components/display/SectionLabel";
import { MetaChip, type ChipTone } from "@/components/display/MetaChip";
import { ProgressBar } from "@/components/display/ProgressBar";
import { DashboardOnboarding } from "@/components/onboarding/DashboardOnboarding";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";

/**
 * Het openingsscherm van de app. Late-banner + drie blokken
 * (Herinneringen · Deadlines · Actieve projecten), gebouwd op de bestaande
 * bouwstenen. "Sinds de app het laatst open stond" komt uit
 * `UserSettings.last_active_at`. Een taakrij aanklikken opent het
 * taakdetailpaneel hier ter plaatse — zonder naar Taken te springen.
 */
export function Dashboard({
  onGotoTasks,
  onGotoProjects,
  onGotoTemplates,
  onGotoAttributes,
  onGotoStatuses,
  onNewTask,
}: {
  onGotoTasks: () => void;
  onGotoProjects: () => void;
  onGotoTemplates: () => void;
  onGotoAttributes: () => void;
  onGotoStatuses: () => void;
  onNewTask: () => void;
}) {
  const { data, isLoading } = useDashboard();
  const { data: onboarding } = useOnboarding();
  const markSeen = useMarkSeen();
  const [openId, setOpenId] = useState<number | null>(null);

  const showOnboarding =
    onboarding != null &&
    !onboarding.hasTemplate &&
    !onboarding.hasProject &&
    !onboarding.hasTodo;

  const since = data?.lastActiveAt
    ? formatShortDateTime(parseLocalDateTime(data.lastActiveAt))
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <ViewHeader
        title={nl.dashboard.title}
        meta={
          <span
            style={{
              fontSize: "var(--text-md)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
            }}
          >
            {showOnboarding
              ? nl.onboarding.dashboard.title
              : formatFullDate(new Date())}
          </span>
        }
        actions={
          showOnboarding ? undefined : (
            <>
              <Button variant="secondary" onClick={onGotoTasks}>
                {nl.dashboard.toAllTasks}
              </Button>
              <Button icon="plus" onClick={onNewTask}>
                {nl.dashboard.newTask}
              </Button>
            </>
          )
        }
      />

      <div style={{ display: "flex", minHeight: 0, flex: 1 }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflow: "auto",
            padding: "var(--space-8) var(--gutter) var(--space-12)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-8)",
          }}
        >
          {showOnboarding ? (
            <DashboardOnboarding
              onGotoTemplates={onGotoTemplates}
              onGotoAttributes={onGotoAttributes}
              onGotoStatuses={onGotoStatuses}
            />
          ) : isLoading || !data ? (
            <p
              style={{
                color: "var(--text-muted)",
                fontWeight: "var(--weight-semibold)",
              }}
            >
              {nl.common.loading}
            </p>
          ) : (
            <>
              {data.lateCount > 0 ? (
                <Banner tone="late">
                  <Icon name="bell" size={16} />
                  <span style={bannerText("var(--late-fg)")}>
                    {nl.dashboard.bannerLate(data.lateCount, since ?? "?")}
                  </span>
                  <div style={{ flex: 1 }} />
                  <Button
                    variant="secondary"
                    onClick={() => markSeen.all.mutate()}
                    disabled={markSeen.all.isPending}
                  >
                    {nl.dashboard.bannerMarkSeen}
                  </Button>
                </Banner>
              ) : (
                <Banner tone="done">
                  <Icon name="check" size={16} />
                  <span style={bannerText("var(--done-fg)")}>
                    {nl.dashboard.nothingLateTitle}
                    {since ? `. ${nl.dashboard.nothingLateBody(since)}` : ""}
                  </span>
                </Banner>
              )}

              <div style={grid}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-8)",
                    minWidth: 0,
                  }}
                >
                  <Section
                    label={nl.dashboard.sectionReminders}
                    count={`${data.reminders.length}`}
                    linkLabel={nl.dashboard.seeAll}
                    onLink={onGotoTasks}
                  >
                    {data.reminders.length === 0 ? (
                      <EmptyRow>{nl.dashboard.noReminders}</EmptyRow>
                    ) : (
                      data.reminders.map((r, i) => (
                        <ReminderRow
                          key={r.reminderId}
                          r={r}
                          last={i === data.reminders.length - 1}
                          onOpen={() => setOpenId(r.todoId)}
                          onSeen={
                            r.wasLate
                              ? () => markSeen.one.mutate(r.reminderId)
                              : undefined
                          }
                        />
                      ))
                    )}
                  </Section>

                  <Section
                    label={nl.dashboard.sectionDeadlines}
                    count={`${data.deadlines.length}`}
                    linkLabel={nl.dashboard.seeAll}
                    onLink={onGotoTasks}
                  >
                    {data.deadlines.length === 0 ? (
                      <EmptyRow>{nl.dashboard.noDeadlines}</EmptyRow>
                    ) : (
                      data.deadlines.map((d, i) => (
                        <DeadlineRow
                          key={d.todoId}
                          d={d}
                          last={i === data.deadlines.length - 1}
                          onOpen={() => setOpenId(d.todoId)}
                        />
                      ))
                    )}
                  </Section>
                </div>

                <Section
                  label={nl.dashboard.sectionProjects}
                  count={nl.dashboard.activeCount(
                    data.activeProjectCount,
                    data.projectCount,
                  )}
                  linkLabel={nl.dashboard.toProjects}
                  onLink={onGotoProjects}
                >
                  {data.activeProjects.length === 0 ? (
                    <EmptyRow>{nl.dashboard.noProjects}</EmptyRow>
                  ) : (
                    data.activeProjects.map((p, i) => {
                      const pct = p.todoCount
                        ? Math.round((p.doneCount / p.todoCount) * 100)
                        : 0;
                      return (
                        <div
                          key={p.id}
                          onClick={onGotoProjects}
                          style={{
                            ...rowBase,
                            flexDirection: "column",
                            alignItems: "stretch",
                            gap: "9px",
                            borderBottom:
                              i === data.activeProjects.length - 1
                                ? "none"
                                : "var(--border-width) solid var(--border-subtle)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "var(--space-4)",
                              minWidth: 0,
                            }}
                          >
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: "var(--radius-round)",
                                background: p.color,
                                flex: "none",
                              }}
                            />
                            <span style={{ ...rowTitle, flex: 1 }}>{p.name}</span>
                            <span style={rowMeta}>
                              {nl.views.groupProgress(p.doneCount, p.todoCount)}
                            </span>
                          </div>
                          <ProgressBar value={pct} width="full" />
                        </div>
                      );
                    })
                  )}
                  <p style={footnote}>{nl.dashboard.activeExplainer}</p>
                  {data.looseTodoCount > 0 ? (
                    <p style={footnote}>
                      {nl.dashboard.looseNote(data.looseTodoCount)}
                    </p>
                  ) : null}
                </Section>
              </div>
            </>
          )}
        </div>

        {openId != null ? (
          <TaskDetailPanel
            key={openId}
            todoId={openId}
            onClose={() => setOpenId(null)}
            onDeleted={() => setOpenId(null)}
            onOpenOther={setOpenId}
          />
        ) : null}
      </div>
    </div>
  );
}

// --- sub-pieces ----------------------------------------------------------

function Section({
  label,
  count,
  linkLabel,
  onLink,
  children,
}: {
  label: string;
  count: string;
  linkLabel: string;
  onLink: () => void;
  children: ReactNode;
}) {
  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: "9px", minWidth: 0 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          padding: "0 var(--space-2)",
        }}
      >
        <SectionLabel>{label}</SectionLabel>
        <span
          style={{
            fontSize: "12.5px",
            fontWeight: "var(--weight-bold)",
            color: "var(--text-muted)",
          }}
        >
          {count}
        </span>
        <div style={{ flex: 1 }} />
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onLink();
          }}
          style={{ fontSize: "12.5px", fontWeight: "var(--weight-bold)" }}
        >
          {linkLabel}
        </a>
      </div>
      <Card>{children}</Card>
    </section>
  );
}

function Banner({ tone, children }: { tone: "late" | "done"; children: ReactNode }) {
  const late = tone === "late";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "11px",
        background: late ? "var(--late-bg)" : "var(--done-bg)",
        border: `var(--border-width) solid ${
          late ? "var(--late-border)" : "var(--done-border)"
        }`,
        borderRadius: "var(--radius)",
        padding: "12px 16px",
        color: late ? "var(--late-fg)" : "var(--done-fg)",
      }}
    >
      {children}
    </div>
  );
}

function ReminderRow({
  r,
  last,
  onOpen,
  onSeen,
}: {
  r: DashboardReminder;
  last: boolean;
  onOpen: () => void;
  onSeen?: () => void;
}) {
  const chip = reminderChip(r);
  return (
    <Row last={last} onOpen={onOpen} icon="bell">
      <div style={rowTextCol}>
        <span style={rowTitle}>{r.title}</span>
        <span style={rowSub}>
          {subtitle(r.projectName, r.position, r.projectTodoCount)}
        </span>
      </div>
      <MetaChip tone={chip.tone}>{chip.text}</MetaChip>
      {onSeen ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSeen();
          }}
          title={nl.dashboard.markRowSeen}
          style={seenBtn}
        >
          <Icon name="check" size={13} />
        </button>
      ) : null}
    </Row>
  );
}

function DeadlineRow({
  d,
  last,
  onOpen,
}: {
  d: DashboardDeadline;
  last: boolean;
  onOpen: () => void;
}) {
  const chip = deadlineChipText(d);
  return (
    <Row last={last} onOpen={onOpen} icon="calendar">
      <div style={rowTextCol}>
        <span style={rowTitle}>{d.title}</span>
        <span style={rowSub}>
          {subtitle(d.projectName, d.position, d.projectTodoCount)}
          {` · ${d.statusName}`}
        </span>
      </div>
      <MetaChip tone={chip.tone}>{chip.text}</MetaChip>
    </Row>
  );
}

function Row({
  last,
  onOpen,
  icon,
  children,
}: {
  last: boolean;
  onOpen: () => void;
  icon: "bell" | "calendar";
  children: ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      style={{
        ...rowBase,
        borderBottom: last ? "none" : "var(--border-width) solid var(--border-subtle)",
      }}
    >
      <Icon name={icon} size={16} />
      {children}
    </div>
  );
}

function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        padding: "13px 16px",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--weight-semibold)",
        color: "var(--text-muted)",
      }}
    >
      {children}
    </p>
  );
}

// --- helpers -----------------------------------------------------------

function subtitle(
  project: string | null,
  position: number | null,
  total: number,
): string {
  if (!project) return nl.dashboard.looseTaskLabel;
  if (position != null && total > 0) {
    return `${project} · ${nl.dashboard.step(position, total)}`;
  }
  return project;
}

function reminderChip(r: DashboardReminder): { tone: ChipTone; text: string } {
  const when = r.fireAt ? parseLocalDateTime(r.fireAt) : null;
  if (r.wasLate) {
    return {
      tone: "late",
      text: nl.dashboard.chipLate(when ? formatShortDateTime(when) : ""),
    };
  }
  if (when && isToday(when)) {
    return { tone: "today", text: nl.dashboard.chipToday(formatTime(when)) };
  }
  return {
    tone: "neutral",
    text: when ? formatShortDateTime(when) : nl.reminderStates.inactive.label,
  };
}

function deadlineChipText(d: DashboardDeadline): { tone: ChipTone; text: string } {
  const day = parseLocalDateTime(d.deadlineDate);
  if (d.missed) {
    const days = Math.round((startOfToday().getTime() - day.getTime()) / 86_400_000);
    return { tone: "late", text: nl.dashboard.daysLate(days) };
  }
  if (isToday(day)) {
    return {
      tone: "today",
      text: nl.dashboard.chipToday(d.deadlineTime ?? ""),
    };
  }
  return { tone: "neutral", text: formatShortDate(day) };
}

function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function isToday(d: Date): boolean {
  return (
    d.getFullYear() === new Date().getFullYear() &&
    d.getMonth() === new Date().getMonth() &&
    d.getDate() === new Date().getDate()
  );
}

// --- styles ----------------------------------------------------------

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: "var(--space-8)",
  alignItems: "start",
};
const rowBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "11px 16px",
  cursor: "pointer",
};
const rowTextCol: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  minWidth: 0,
  flex: 1,
};
const rowTitle: CSSProperties = {
  fontSize: "14.5px",
  fontWeight: "var(--weight-bold)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const rowSub: CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-muted)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const rowMeta: CSSProperties = {
  fontSize: "12.5px",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-muted)",
  flex: "none",
};
const footnote: CSSProperties = {
  margin: 0,
  padding: "10px 16px",
  fontSize: "var(--text-xs)",
  fontWeight: "var(--weight-semibold)",
  color: "var(--text-muted)",
  borderTop: "var(--border-width) solid var(--border-subtle)",
};
const seenBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 26,
  height: 26,
  flex: "none",
  border: "var(--border-width) solid var(--border-default)",
  borderRadius: "var(--radius)",
  background: "var(--surface-card)",
  color: "var(--text-secondary)",
  cursor: "pointer",
};
const bannerText = (color: string): CSSProperties => ({
  fontSize: "13.5px",
  fontWeight: "var(--weight-bold)",
  color,
  lineHeight: "var(--leading-snug)",
  minWidth: 0,
});
