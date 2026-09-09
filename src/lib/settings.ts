/**
 * Mirrors `core::settings::UserSettings`. One row, round-tripped via serde.
 * `columnConfig` is opaque per-view table column configuration (JSON).
 */
export interface UserSettings {
  /** Always true in v1 (spec). */
  runInBackground: boolean;
  /** Default false, not UI-configurable in v1 (spec). */
  autostart: boolean;
  /** ISO-8601 local datetime, no offset — or null before the first run finishes. */
  lastActiveAt: string | null;
  /** ISO-8601 local datetime, no offset. */
  lastUpdateCheckAt: string | null;
  /** Per-view table column configuration; shape owned by the takenviews. */
  columnConfig: Record<string, unknown>;
}

export const defaultUserSettings: UserSettings = {
  runInBackground: true,
  autostart: false,
  lastActiveAt: null,
  lastUpdateCheckAt: null,
  columnConfig: {},
};
