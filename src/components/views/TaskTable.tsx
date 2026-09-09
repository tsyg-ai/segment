import { useMemo, type CSSProperties } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { nl } from "@/i18n";
import type { Todo, Project } from "@/lib/taskTypes";
import type { Status } from "@/lib/statusTypes";
import type { AttributeColumn } from "@/lib/viewTypes";
import { useStatuses } from "@/lib/beheerQueries";
import { useProjects } from "@/lib/taskQueries";
import { useAttributeColumns, useViewPrefs } from "@/lib/viewQueries";
import { resolveColumnOrder } from "@/lib/viewColumns";
import { useViewState } from "@/store/useViewState";
import { formatShortDate, formatNumber } from "@/i18n/format";
import { isoToDisplayDate } from "@/components/forms/DateField";
import { Icon } from "@/components/core/Icon";
import { Checkbox } from "@/components/core/Checkbox";

/**
 * Tabel-view (spec §8) op **TanStack Table**. Kolommen tonen o.a. **kenmerken**
 * (dynamisch uit `attribute_definition`). Per kolom **sorteerbaar**. Kolommen
 * **tonen/verbergen** en **herordenen** per gebruiker, **persistent**
 * (`user_settings`-kolomconfig per view). Sortering + kolomconfig zijn
 * **view-lokaal**.
 */
// Stable empties: a still-loading query must not hand a fresh `[]` to the memo
// deps / TanStack Table on every render — that spins react-table into a
// synchronous render loop.
const NO_STATUSES: Status[] = [];
const NO_PROJECTS: Project[] = [];
const NO_ATTR_COLS: AttributeColumn[] = [];

export function TaskTable({
  todos,
  onOpen,
}: {
  todos: Todo[];
  onOpen: (id: number) => void;
}) {
  const statuses = useStatuses().data ?? NO_STATUSES;
  const projects = useProjects(["active", "completed", "archived"]).data ?? NO_PROJECTS;
  const attrCols = useAttributeColumns().data ?? NO_ATTR_COLS;
  const { prefs, setPrefs } = useViewPrefs("table");
  const selection = useViewState((s) => s.selection);
  const toggleSelected = useViewState((s) => s.toggleSelected);

  const statusById = useMemo(() => {
    const m = new Map<number, Status>();
    statuses.forEach((s) => m.set(s.id, s));
    return m;
  }, [statuses]);
  const projectById = useMemo(() => {
    const m = new Map<number, Project>();
    projects.forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  const order = useMemo(() => resolveColumnOrder(prefs, attrCols), [prefs, attrCols]);
  const hidden = useMemo(
    () => new Set(prefs.hiddenColumns ?? []),
    [prefs.hiddenColumns],
  );

  const columns = useMemo<ColumnDef<Todo>[]>(() => {
    const attrCell = (col: AttributeColumn, t: Todo) => {
      const v = t.attributeValues.find((av) => av.attributeId === col.id);
      if (!v) return "";
      if (v.optionLabels.length) return v.optionLabels.join(", ");
      if (v.valueText) return v.valueText;
      if (v.valueNumber != null)
        return `${formatNumber(v.valueNumber)}${col.numberUnit ? ` ${col.numberUnit}` : ""}`;
      if (v.valueDate)
        return `${isoToDisplayDate(v.valueDate)}${v.valueTime ? ` ${v.valueTime}` : ""}`;
      if (v.valueBool != null) return v.valueBool ? "✓" : "";
      return "";
    };
    const map: Record<string, ColumnDef<Todo>> = {
      title: {
        id: "title",
        header: nl.views.colTitle,
        accessorFn: (t) => t.title,
        cell: (c) => <span style={strong}>{c.getValue<string>()}</span>,
      },
      project: {
        id: "project",
        header: nl.views.colProject,
        accessorFn: (t) =>
          t.projectId == null
            ? nl.tasks.loose
            : (projectById.get(t.projectId)?.name ?? ""),
      },
      status: {
        id: "status",
        header: nl.views.colStatus,
        accessorFn: (t) => statusById.get(t.statusId)?.name ?? "",
      },
      deadline: {
        id: "deadline",
        header: nl.views.colDeadline,
        accessorFn: (t) => t.deadlineDate ?? "",
        cell: (c) => {
          const d = c.getValue<string>();
          if (!d) return "";
          const [y, mo, day] = d.split("-").map(Number);
          return formatShortDate(new Date(y, (mo ?? 1) - 1, day ?? 1));
        },
      },
      created: {
        id: "created",
        header: nl.views.colCreated,
        accessorFn: (t) => t.createdAt.slice(0, 10),
      },
    };
    for (const col of attrCols) {
      map[`attr:${col.id}`] = {
        id: `attr:${col.id}`,
        header: col.name,
        accessorFn: (t) => attrCell(col, t),
      };
    }
    return order
      .filter((id) => !hidden.has(id))
      .map((id) => map[id])
      .filter(Boolean);
  }, [order, hidden, attrCols, statusById, projectById]);

  const sorting = useMemo<SortingState>(
    () => (prefs.sort ? [prefs.sort] : []),
    [prefs.sort],
  );
  const tableState = useMemo(() => ({ sorting }), [sorting]);

  const table = useReactTable({
    data: todos,
    columns,
    state: tableState,
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      setPrefs({ sort: next[0] ?? null });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (todos.length === 0) {
    return <p style={emptyText}>{nl.views.emptyFiltered}</p>;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        minHeight: 0,
        flex: 1,
      }}
    >
      <div
        style={{
          overflow: "auto",
          flex: 1,
          minHeight: 0,
          borderRadius: "var(--radius)",
          border: "var(--border-width) solid var(--border-default)",
        }}
      >
        <table style={tableEl}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                <th style={{ ...th, width: 34 }} />
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ ...th, cursor: "pointer" }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span
                      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: <Icon name="arrow-up" size={11} />,
                        desc: <Icon name="arrow-down" size={11} />,
                      }[header.column.getIsSorted() as string] ?? null}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onOpen(row.original.id)}
                style={{ cursor: "pointer" }}
              >
                <td style={td} onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selection.has(row.original.id)}
                    onChange={() => toggleSelected(row.original.id)}
                    label={nl.views.selectTask}
                  />
                </td>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} style={td}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const emptyText: CSSProperties = {
  margin: 0,
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-medium)",
  color: "var(--text-secondary)",
};
const strong: CSSProperties = { fontWeight: "var(--weight-bold)" };
const tableEl: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "var(--text-sm)",
  background: "var(--surface-card)",
};
const th: CSSProperties = {
  textAlign: "left",
  padding: "9px 12px",
  fontWeight: "var(--weight-black)",
  fontSize: "var(--text-xs)",
  color: "var(--text-secondary)",
  borderBottom: "var(--border-width) solid var(--border-default)",
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
  background: "var(--surface-sunken)",
};
const td: CSSProperties = {
  padding: "9px 12px",
  borderBottom: "var(--border-width) solid var(--border-subtle)",
  color: "var(--text-body)",
  fontWeight: "var(--weight-semibold)",
  whiteSpace: "nowrap",
  maxWidth: 280,
  overflow: "hidden",
  textOverflow: "ellipsis",
};
