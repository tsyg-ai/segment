import { useState, type CSSProperties } from "react";
import { nl } from "@/i18n";
import type { TaskSubView } from "@/store/useViewState";
import type { AttributeColumn } from "@/lib/viewTypes";
import { useViewPrefs, useAttributeColumns } from "@/lib/viewQueries";
import { resolveColumnOrder, columnLabel, BUILTIN_COLUMNS } from "@/lib/viewColumns";
import { Icon } from "@/components/core/Icon";
import { Checkbox } from "@/components/core/Checkbox";
import { FilterChip } from "@/components/forms/FilterChip";

const NO_ATTR_COLS: AttributeColumn[] = [];

/** One removable filter chip, resolved to a label by {@link TakenView}. */
export interface ViewChip {
  key: string;
  label: string;
  remove: () => void;
}

/**
 * The right-hand cluster of the Taken header's second row: the active filter
 * chips, the **Filter** toggle and the **view-local** controls — Sorteren
 * (Lijst / Tabel / Bord), Groeperen (Lijst) and Kolommen (Tabel). Kalender has
 * no extra controls. Clearing the filter lives in the shared voetbalk.
 *
 * Sorting/grouping/column prefs live in `useViewPrefs(sub)` and are read back
 * by the view bodies through the same (react-query cached) hook.
 */
export function ViewControls({
  sub,
  filterPanelOpen,
  onToggleFilterPanel,
  activeFilterCount,
  chips,
}: {
  sub: TaskSubView;
  filterPanelOpen: boolean;
  onToggleFilterPanel: () => void;
  activeFilterCount: number;
  chips: ViewChip[];
}) {
  // Show the chip inline only when a single filter is active. From two on, the
  // row would get noisy — the Filter button's active state already signals that
  // filters are applied, and the panel shows the details.
  const inlineChips = chips.length === 1 ? chips : [];

  return (
    <div style={cluster}>
      {inlineChips.map((c) => (
        <FilterChip key={c.key} onRemove={c.remove}>
          {c.label}
        </FilterChip>
      ))}

      <button
        type="button"
        onClick={onToggleFilterPanel}
        aria-pressed={filterPanelOpen}
        style={filterPanelOpen || activeFilterCount > 0 ? tintedBtn : plainBtn}
      >
        <Icon name="funnel" size={13} />
        {nl.views.filterTitle}
        {activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
      </button>

      {sub === "list" ? <ListControls /> : null}
      {sub === "table" ? <TableControls /> : null}
      {sub === "kanban" ? <KanbanControls /> : null}
    </div>
  );
}

/** Next `{id, desc}` when a Sorteren option is picked: same id flips direction. */
function nextSort(
  cur: { id: string; desc: boolean },
  id: string,
): { id: string; desc: boolean } {
  return cur.id === id ? { id, desc: !cur.desc } : { id, desc: false };
}

/* --- Lijst: Sorteren + Groeperen ---------------------------------------- */

const LIST_SORT_IDS = ["position", "title", "deadline", "created"] as const;
type ListSortId = (typeof LIST_SORT_IDS)[number];

function listSortLabel(id: ListSortId): string {
  return {
    position: nl.views.sortByStep,
    title: nl.views.sortByTitle,
    deadline: nl.views.sortByDeadline,
    created: nl.views.sortByCreated,
  }[id];
}

const LIST_GROUP_IDS = ["project", "status", "none"] as const;
type ListGroupId = (typeof LIST_GROUP_IDS)[number];

function listGroupLabel(id: ListGroupId): string {
  return {
    project: nl.views.groupByProject,
    status: nl.views.groupByStatus,
    none: nl.views.groupByNone,
  }[id];
}

function ListControls() {
  const { prefs, setPrefs } = useViewPrefs("list");
  const group: ListGroupId = (LIST_GROUP_IDS as readonly string[]).includes(
    prefs.group ?? "",
  )
    ? (prefs.group as ListGroupId)
    : "project";
  const sort = prefs.sort ?? { id: "position", desc: false };
  const active = (LIST_SORT_IDS as readonly string[]).includes(sort.id)
    ? (sort.id as ListSortId)
    : "position";

  return (
    <>
      <SortMenu
        current={listSortLabel(active)}
        desc={sort.desc}
        options={LIST_SORT_IDS.map((id) => ({ id, label: listSortLabel(id) }))}
        activeId={active}
        onPick={(id) => setPrefs({ sort: nextSort(sort, id) })}
      />
      <GroupMenu
        current={listGroupLabel(group)}
        active={group !== "none"}
        options={LIST_GROUP_IDS.map((id) => ({ id, label: listGroupLabel(id) }))}
        activeId={group}
        onPick={(id) => setPrefs({ group: id as ListGroupId })}
      />
    </>
  );
}

/** Groeperen popover (Lijst) — dezelfde look als {@link SortMenu}, zonder richting. */
function GroupMenu({
  current,
  active,
  options,
  activeId,
  onPick,
}: {
  current: string;
  active: boolean;
  options: { id: string; label: string }[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={open || active ? tintedBtn : plainBtn}
      >
        <Icon name="layout-list" size={13} />
        {`${nl.views.groupBy}: ${current}`}
      </button>
      {open ? (
        <>
          <div style={backdrop} onClick={() => setOpen(false)} />
          <div style={{ ...menuCard, width: 220 }} role="menu">
            {options.map((o) => {
              const isActive = o.id === activeId;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    onPick(o.id);
                    setOpen(false);
                  }}
                  style={menuItem}
                >
                  <span
                    style={{
                      ...radio,
                      borderColor: isActive
                        ? "var(--accent)"
                        : "var(--border-strong, #C3CBC6)",
                    }}
                  >
                    {isActive ? <span style={radioDot} /> : null}
                  </span>
                  <span style={{ flex: 1 }}>{o.label}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* --- Tabel: Sorteren + Kolommen --------------------------------------- */

function TableControls() {
  const { prefs, setPrefs } = useViewPrefs("table");
  const attrCols = useAttributeColumns().data ?? NO_ATTR_COLS;
  const [pickerOpen, setPickerOpen] = useState(false);

  const sort = prefs.sort ?? null;
  const order = resolveColumnOrder(prefs, attrCols);
  const hidden = new Set(prefs.hiddenColumns ?? []);
  const shown = order.filter((id) => !hidden.has(id)).length;

  const toggleHidden = (id: string) => {
    const h = new Set(hidden);
    if (h.has(id)) h.delete(id);
    else h.add(id);
    setPrefs({ hiddenColumns: [...h] });
  };
  const move = (id: string, dir: -1 | 1) => {
    const arr = [...order];
    const i = arr.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setPrefs({ columnOrder: arr });
  };

  return (
    <>
      <SortMenu
        current={sort ? columnLabel(sort.id, attrCols) : nl.views.sortByDeadline}
        desc={sort?.desc ?? false}
        options={BUILTIN_COLUMNS.map((id) => ({
          id,
          label: columnLabel(id, attrCols),
        }))}
        activeId={sort?.id ?? null}
        onPick={(id) =>
          setPrefs({ sort: nextSort(sort ?? { id: "", desc: false }, id) })
        }
      />

      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          style={pickerOpen ? tintedBtn : plainBtn}
        >
          <Icon name="layout-list" size={13} />
          {`${nl.views.columns}: ${shown}/${order.length}`}
          <Icon name="chevron-down" size={13} />
        </button>
        {pickerOpen ? (
          <>
            <div style={backdrop} onClick={() => setPickerOpen(false)} />
            <div style={menuCard}>
              {order.map((id) => (
                <div key={id} style={pickerRow}>
                  <Checkbox
                    checked={!hidden.has(id)}
                    onChange={() => toggleHidden(id)}
                    label={columnLabel(id, attrCols)}
                  />
                  <span style={{ flex: 1, ...pickerRowLabel }}>
                    {columnLabel(id, attrCols)}
                  </span>
                  <button
                    type="button"
                    style={moveBtn}
                    onClick={() => move(id, -1)}
                    aria-label={nl.views.moveUp}
                  >
                    <Icon name="chevron-up" size={12} />
                  </button>
                  <button
                    type="button"
                    style={moveBtn}
                    onClick={() => move(id, 1)}
                    aria-label={nl.views.moveDown}
                  >
                    <Icon name="chevron-down" size={12} />
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

/* --- Bord: vaste sortering per kolom — zelfde knop als de lijst ------ */

const KANBAN_SORT_IDS = ["title", "deadline", "created"] as const;

function kanbanSortLabel(id: string): string {
  return (
    {
      title: nl.views.sortByTitle,
      deadline: nl.views.sortByDeadline,
      created: nl.views.sortByCreated,
    }[id] ?? id
  );
}

function KanbanControls() {
  const { prefs, setPrefs } = useViewPrefs("kanban");
  const sort = prefs.sort ?? { id: "title", desc: false };
  const active = (KANBAN_SORT_IDS as readonly string[]).includes(sort.id)
    ? sort.id
    : "title";
  return (
    <SortMenu
      current={kanbanSortLabel(active)}
      desc={sort.desc}
      options={KANBAN_SORT_IDS.map((id) => ({ id, label: kanbanSortLabel(id) }))}
      activeId={active}
      onPick={(id) => setPrefs({ sort: nextSort(sort, id) })}
    />
  );
}

/* --- Sorteren popover (alle views) -------------------------------- */

function SortMenu({
  current,
  desc,
  options,
  activeId,
  onPick,
}: {
  current: string;
  desc: boolean;
  options: { id: string; label: string }[];
  activeId: string | null;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={open ? tintedBtn : plainBtn}
      >
        {`${nl.views.sortLabel}: ${current}`}
        <Icon name={desc ? "arrow-down" : "arrow-up"} size={13} />
      </button>
      {open ? (
        <>
          <div style={backdrop} onClick={() => setOpen(false)} />
          <div style={{ ...menuCard, width: 220 }} role="menu">
            {options.map((o) => {
              const isActive = o.id === activeId;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => onPick(o.id)}
                  style={menuItem}
                >
                  <span
                    style={{
                      ...radio,
                      borderColor: isActive
                        ? "var(--accent)"
                        : "var(--border-strong, #C3CBC6)",
                    }}
                  >
                    {isActive ? <span style={radioDot} /> : null}
                  </span>
                  <span style={{ flex: 1 }}>{o.label}</span>
                  {isActive ? (
                    <Icon name={desc ? "arrow-down" : "arrow-up"} size={12} />
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* --- styles -------------------------------------------------------- */

const cluster: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-4)",
  flexWrap: "wrap",
  paddingBottom: "var(--space-4)",
  marginLeft: "auto",
};
const btnBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  height: "var(--control-h-sm)",
  padding: "0 12px",
  borderRadius: "var(--radius)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-base)",
  fontWeight: "var(--weight-bold)",
  cursor: "pointer",
  whiteSpace: "nowrap",
  flex: "none",
};
const plainBtn: CSSProperties = {
  ...btnBase,
  border: "var(--border-width) solid var(--border-default)",
  background: "var(--surface-card)",
  color: "var(--text-body)",
};
const tintedBtn: CSSProperties = {
  ...btnBase,
  border: "var(--border-width) solid var(--accent-tint-border)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
};
const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 30,
};
const menuCard: CSSProperties = {
  position: "absolute",
  top: "calc(var(--control-h-sm) + 6px)",
  right: 0,
  zIndex: 31,
  width: 260,
  background: "var(--surface-card)",
  border: "var(--border-width) solid var(--border-default)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-window)",
  padding: "8px",
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};
const menuItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  width: "100%",
  padding: "8px 8px",
  border: 0,
  background: "transparent",
  borderRadius: "var(--radius-sm)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-base)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-body)",
  cursor: "pointer",
  textAlign: "left",
};
const radio: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: "var(--radius-round)",
  border: "2px solid var(--border-strong, #C3CBC6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "none",
};
const radioDot: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: "var(--radius-round)",
  background: "var(--accent)",
};
const pickerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-4)",
  padding: "4px 6px",
};
const pickerRowLabel: CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: "var(--weight-bold)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const moveBtn: CSSProperties = {
  width: 22,
  height: 22,
  border: "var(--border-width) solid var(--border-default)",
  background: "var(--surface-card)",
  borderRadius: "var(--radius-sm)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "var(--text-secondary)",
  flex: "none",
};
