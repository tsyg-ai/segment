/**
 * Central query-key factory. Every TanStack Query key in the app comes from
 * here so cache invalidation stays predictable across features.
 *
 * Convention: `qk.<domain>.all` is the broad invalidation handle; more specific
 * keys extend it, e.g. `qk.projects.detail(id)`.
 */
export const qk = {
  settings: {
    all: ["settings"] as const,
  },
  statuses: {
    all: ["statuses"] as const,
  },
  projects: {
    all: ["projects"] as const,
    list: (stateFilter: readonly string[]) =>
      ["projects", "list", [...stateFilter].sort()] as const,
    detail: (id: number) => ["projects", "detail", id] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    list: (filters: Record<string, unknown>) => ["tasks", "list", filters] as const,
    detail: (id: number) => ["tasks", "detail", id] as const,
  },
  views: {
    all: ["views"] as const,
    /** The gedeelde-filter query behind Lijst / Tabel / Kanban. */
    list: (filter: unknown, search: string) =>
      ["views", "list", filter, search] as const,
    counts: (filter: unknown, search: string) =>
      ["views", "counts", filter, search] as const,
    attributeColumns: ["views", "attributeColumns"] as const,
    prefs: (view: string) => ["views", "prefs", view] as const,
  },
  templates: {
    all: ["templates"] as const,
    detail: (id: number) => ["templates", "detail", id] as const,
    todos: (id: number) => ["template", id, "todos"] as const,
    /** Prefix matching every `todos(id)` key, for invalidation when the id is unknown. */
    todosAll: ["template"] as const,
  },
  attributes: {
    all: ["attributes"] as const,
    detail: (id: number) => ["attribute", id] as const,
    options: (id: number) => ["attribute", id, "options"] as const,
  },
  reminders: {
    all: ["reminders"] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
  },
  calendar: {
    all: ["calendar"] as const,
    range: (from: string, to: string, filter: unknown, search: string) =>
      ["calendar", from, to, filter, search] as const,
  },
  onboarding: {
    all: ["onboarding"] as const,
  },
} as const;
