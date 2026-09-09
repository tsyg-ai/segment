import { nl } from "@/i18n";
import type { AttributeColumn } from "./viewTypes";
import type { ViewPrefs } from "./viewTypes";

/**
 * Shared column model for the Tabel-view. The header's kolomkiezer
 * ({@link ViewControls}) and the table body ({@link TaskTable}) must agree on
 * the id set, the resolved order and the labels, so that logic lives here.
 */
export const BUILTIN_COLUMNS = [
  "title",
  "project",
  "status",
  "deadline",
  "created",
] as const;

/** Every column id in canonical order: built-ins first, then kenmerken. */
export function allColumnIds(attrCols: AttributeColumn[]): string[] {
  return [...BUILTIN_COLUMNS, ...attrCols.map((a) => `attr:${a.id}`)];
}

/**
 * The user's saved order, reconciled against the columns that currently exist
 * (drops stale ids, appends new ones).
 */
export function resolveColumnOrder(
  prefs: ViewPrefs,
  attrCols: AttributeColumn[],
): string[] {
  const ids = allColumnIds(attrCols);
  const saved = prefs.columnOrder ?? [];
  return saved.length
    ? [
        ...saved.filter((id) => ids.includes(id)),
        ...ids.filter((id) => !saved.includes(id)),
      ]
    : ids;
}

/** Human label for a column id (built-in or `attr:<id>`). */
export function columnLabel(id: string, attrCols: AttributeColumn[]): string {
  if (id.startsWith("attr:")) {
    return attrCols.find((a) => `attr:${a.id}` === id)?.name ?? id;
  }
  return (
    {
      title: nl.views.colTitle,
      project: nl.views.colProject,
      status: nl.views.colStatus,
      deadline: nl.views.colDeadline,
      created: nl.views.colCreated,
    }[id] ?? id
  );
}
