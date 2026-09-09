/**
 * DTOs for the takenviews — mirror `core::views`. The filter is the
 * only cross-view shared state (spec §8.1); it is sent to `list_todos_view` and
 * `count_visible_and_late`.
 */
import type { AttributeType, AttributeScope } from "./beheerTypes";
import type { TodoFilter, DeadlineFilter, AttributeFilter } from "@/store/useViewState";

export type { TodoFilter, DeadlineFilter, AttributeFilter };

/** The three footer counts (`N van M taken zichtbaar` · `N te laat`). */
export interface VisibleCount {
  visible: number;
  total: number;
  late: number;
}

/** One dynamic kenmerk column for the Tabel. */
export interface AttributeColumn {
  id: number;
  name: string;
  type: AttributeType;
  scope: AttributeScope;
  templateId: number | null;
  numberUnit: string | null;
  selectMultiple: boolean;
}

/** Per-view local prefs blob persisted under `user_settings.column_config[view]`. */
export interface ViewPrefs {
  /** List: group tasks by project or status, or don't. */
  group?: "project" | "status" | "none";
  /** List / Table / Kanban: sort key + direction (Kanban = fixed per-column). */
  sort?: { id: string; desc: boolean } | null;
  /** Table: ordered visible column ids (built-ins + `attr:<id>`). */
  columnOrder?: string[];
  /** Table: hidden column ids. */
  hiddenColumns?: string[];
}
