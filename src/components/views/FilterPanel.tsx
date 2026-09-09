import { useMemo, type CSSProperties, type ReactNode } from "react";
import { nl } from "@/i18n";
import { Icon } from "@/components/core/Icon";
import { Checkbox } from "@/components/core/Checkbox";
import { DateField } from "@/components/forms/DateField";
import { useStatuses, useAttributes } from "@/lib/beheerQueries";
import { useProjects } from "@/lib/taskQueries";
import {
  useViewState,
  type DeadlineFilter,
  type TodoFilter,
  filterIsEmpty,
} from "@/store/useViewState";

/**
 * The dedicated filter panel (spec §8.1, mockup `_filter-takenlijst`) — ±320 px,
 * pinned to the right of the takenviews. Groups: **Status · Deadline · Project ·
 * global kenmerken · projectkenmerken**. Every kenmerk group carries a
 * **"Niet ingevuld"** value (query-helper `todos_without_value`).
 * Projectkenmerken only show when the filter is on **exactly one project of that
 * sjabloon**.
 */
export function FilterPanel({ onClose }: { onClose: () => void }) {
  const filter = useViewState((s) => s.filter);
  const patch = useViewState((s) => s.patchFilter);
  const clear = useViewState((s) => s.clearFilter);

  const { data: statuses = [] } = useStatuses();
  const { data: attributes = [] } = useAttributes();
  const { data: projects = [] } = useProjects(["active", "completed"]);

  const globalAttrs = attributes.filter((a) => a.scope === "global");

  // Projectkenmerken: alleen als er op precies één project gefilterd wordt en
  // dat project uit een sjabloon komt — dan de kenmerken van dát sjabloon.
  const soleProject =
    filter.projectIds.length === 1
      ? (projects.find((p) => p.id === filter.projectIds[0]) ?? null)
      : null;
  const projectAttrs = useMemo(
    () =>
      soleProject?.templateId != null
        ? attributes.filter(
            (a) => a.scope === "project" && a.templateId === soleProject.templateId,
          )
        : [],
    [attributes, soleProject],
  );

  const toggleStatus = (id: number) =>
    patch({
      statusIds: filter.statusIds.includes(id)
        ? filter.statusIds.filter((s) => s !== id)
        : [...filter.statusIds, id],
    });

  const toggleProject = (id: number) =>
    patch({
      projectIds: filter.projectIds.includes(id)
        ? filter.projectIds.filter((p) => p !== id)
        : [...filter.projectIds, id],
    });

  const setDeadline = (d: DeadlineFilter | null) => patch({ deadline: d });
  const deadlineActive = (kind: DeadlineFilter["kind"]) =>
    filter.deadline?.kind === kind;

  return (
    <aside style={panel} aria-label={nl.views.filterTitle}>
      <header style={head}>
        <span style={headTitle}>{nl.views.filterTitle}</span>
        <div style={{ flex: 1 }} />
        {!filterIsEmpty(filter) ? (
          <button type="button" onClick={clear} style={linkBtn}>
            {nl.views.filterClearAll}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          style={{ ...linkBtn, display: "inline-flex" }}
          aria-label={nl.beheer.close}
        >
          <Icon name="x" size={14} />
        </button>
      </header>

      <div style={body}>
        <Group label={nl.views.filterGroupStatus}>
          {statuses.map((s) => (
            <Row
              key={s.id}
              checked={filter.statusIds.includes(s.id)}
              onToggle={() => toggleStatus(s.id)}
              label={s.name}
            />
          ))}
        </Group>

        <Group label={nl.views.filterGroupDeadline}>
          {(
            [
              ["overdue", nl.views.deadlineOverdue],
              ["today", nl.views.deadlineToday],
              ["thisWeek", nl.views.deadlineThisWeek],
              ["noDeadline", nl.views.deadlineNone],
            ] as const
          ).map(([kind, label]) => (
            <Row
              key={kind}
              checked={deadlineActive(kind)}
              onToggle={() => setDeadline(deadlineActive(kind) ? null : { kind })}
              label={label}
            />
          ))}
          <div style={{ display: "flex", gap: "var(--space-4)", marginTop: 4 }}>
            <DateField
              aria-label={nl.views.deadlineRangeFrom}
              value={
                filter.deadline?.kind === "range" ? (filter.deadline.from ?? "") : ""
              }
              onChange={(iso) =>
                setDeadline({
                  kind: "range",
                  from: iso || null,
                  to:
                    filter.deadline?.kind === "range"
                      ? (filter.deadline.to ?? null)
                      : null,
                })
              }
              style={dateInput}
            />
            <DateField
              aria-label={nl.views.deadlineRangeTo}
              value={
                filter.deadline?.kind === "range" ? (filter.deadline.to ?? "") : ""
              }
              onChange={(iso) =>
                setDeadline({
                  kind: "range",
                  from:
                    filter.deadline?.kind === "range"
                      ? (filter.deadline.from ?? null)
                      : null,
                  to: iso || null,
                })
              }
              style={dateInput}
            />
          </div>
        </Group>

        <Group label={nl.views.filterGroupProject}>
          {projects.length === 0 ? (
            <span style={hint}>{nl.views.filterNoProjects}</span>
          ) : (
            projects.map((p) => (
              <Row
                key={p.id}
                checked={filter.projectIds.includes(p.id)}
                onToggle={() => toggleProject(p.id)}
                label={p.name}
              />
            ))
          )}
        </Group>

        {globalAttrs.length > 0 ? (
          <Group label={nl.views.filterGroupGlobalAttrs}>
            {globalAttrs.map((a) => (
              <AttributeRows key={a.id} attribute={a} filter={filter} patch={patch} />
            ))}
          </Group>
        ) : null}

        {projectAttrs.length > 0 ? (
          <Group label={nl.views.filterGroupProjectAttrs}>
            {projectAttrs.map((a) => (
              <AttributeRows key={a.id} attribute={a} filter={filter} patch={patch} />
            ))}
          </Group>
        ) : null}
      </div>
    </aside>
  );
}

function AttributeRows({
  attribute,
  filter,
  patch,
}: {
  attribute: import("@/lib/beheerTypes").AttributeDefinition;
  filter: TodoFilter;
  patch: (p: Partial<TodoFilter>) => void;
}) {
  const current = filter.attributes.find((f) => f.attributeId === attribute.id) ?? {
    attributeId: attribute.id,
    optionIds: [],
    withoutValue: false,
    withValue: false,
    boolValue: null,
  };

  const write = (next: import("@/store/useViewState").AttributeFilter) => {
    const rest = filter.attributes.filter((f) => f.attributeId !== attribute.id);
    const active =
      next.optionIds.length > 0 ||
      next.withoutValue ||
      next.withValue ||
      next.boolValue != null;
    patch({ attributes: active ? [...rest, next] : rest });
  };

  const toggleOption = (id: number) =>
    write({
      ...current,
      optionIds: current.optionIds.includes(id)
        ? current.optionIds.filter((o) => o !== id)
        : [...current.optionIds, id],
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={attrName}>{attribute.name}</span>

      {attribute.options.map((o) => (
        <Row
          key={o.id}
          indented
          checked={current.optionIds.includes(o.id)}
          onToggle={() => toggleOption(o.id)}
          label={o.label}
        />
      ))}

      {attribute.type === "checkbox" ? (
        <>
          <Row
            indented
            checked={current.boolValue === true}
            onToggle={() =>
              write({
                ...current,
                boolValue: current.boolValue === true ? null : true,
              })
            }
            label={nl.views.filterChecked}
          />
          <Row
            indented
            checked={current.boolValue === false}
            onToggle={() =>
              write({
                ...current,
                boolValue: current.boolValue === false ? null : false,
              })
            }
            label={nl.views.filterUnchecked}
          />
        </>
      ) : (
        <>
          {attribute.type !== "select" ? (
            <Row
              indented
              checked={current.withValue}
              onToggle={() => write({ ...current, withValue: !current.withValue })}
              label={nl.views.filterFilledIn}
            />
          ) : null}
          <Row
            indented
            checked={current.withoutValue}
            onToggle={() => write({ ...current, withoutValue: !current.withoutValue })}
            label={nl.views.filterNotFilledIn}
          />
        </>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
    >
      <span style={groupLabel}>{label}</span>
      {children}
    </section>
  );
}

function Row({
  checked,
  onToggle,
  label,
  indented = false,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  indented?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-4)",
        paddingLeft: indented ? "var(--space-6)" : 0,
        fontSize: "var(--text-base)",
        fontWeight: "var(--weight-bold)",
        color: "var(--text-body)",
        cursor: "pointer",
      }}
    >
      <Checkbox checked={checked} onChange={onToggle} label={label} />
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </label>
  );
}

const panel: CSSProperties = {
  width: "var(--filter-panel-w, 320px)",
  flex: "none",
  background: "var(--surface-panel)",
  borderLeft: "var(--border-width) solid var(--border-default)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};
const head: CSSProperties = {
  flex: "none",
  display: "flex",
  alignItems: "center",
  gap: "var(--space-4)",
  padding: "14px 16px",
  borderBottom: "var(--border-width) solid var(--border-default)",
};
const headTitle: CSSProperties = {
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-black)",
};
const body: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-8)",
};
const groupLabel: CSSProperties = {
  fontSize: "var(--text-2xs)",
  fontWeight: "var(--weight-black)",
  letterSpacing: "0.7px",
  textTransform: "uppercase",
  color: "var(--text-label)",
};
const attrName: CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: "var(--weight-black)",
  color: "var(--text-secondary)",
};
const hint: CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: "var(--weight-semibold)",
  color: "var(--text-muted)",
};
const linkBtn: CSSProperties = {
  border: 0,
  background: "transparent",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-sm)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-link)",
  cursor: "pointer",
  padding: 0,
  alignItems: "center",
};
const dateInput: CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: 32,
  border: "var(--border-width) solid var(--border-default)",
  borderRadius: "var(--radius)",
  padding: "0 8px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-sm)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-body)",
  background: "var(--surface-card)",
};
