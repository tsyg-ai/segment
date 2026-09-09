import type { TaskSubView } from "@/store/useViewState";

/** The six sidebar destinations. Kalender is NOT here — it is a sub-view of Taken. */
export type Destination =
  "dashboard" | "taken" | "projecten" | "sjablonen" | "kenmerken" | "statussen";

export const DESTINATIONS: readonly Destination[] = [
  "dashboard",
  "taken",
  "projecten",
  "sjablonen",
  "kenmerken",
  "statussen",
] as const;

export const SIDEBAR_GROUPS: {
  labelKey: string;
  items: { dest: Destination; labelKey: string }[];
}[] = [
  {
    labelKey: "nav.groupOverview",
    items: [
      { dest: "dashboard", labelKey: "nav.dashboard" },
      { dest: "taken", labelKey: "nav.tasks" },
      { dest: "projecten", labelKey: "nav.projects" },
    ],
  },
  {
    labelKey: "nav.groupManage",
    items: [
      { dest: "sjablonen", labelKey: "nav.templates" },
      { dest: "kenmerken", labelKey: "nav.attributes" },
      { dest: "statussen", labelKey: "nav.statuses" },
    ],
  },
];

export const TASK_SUBVIEWS: readonly TaskSubView[] = [
  "list",
  "table",
  "kanban",
  "calendar",
] as const;

export interface Route {
  dest: Destination;
  /** Only meaningful when dest === "taken". */
  sub: TaskSubView;
}

const DEFAULT_ROUTE: Route = { dest: "dashboard", sub: "list" };

function isDestination(v: string): v is Destination {
  return (DESTINATIONS as readonly string[]).includes(v);
}
function isSubView(v: string): v is TaskSubView {
  return (TASK_SUBVIEWS as readonly string[]).includes(v);
}

/** Parse `#/taken/kalender` → { dest: "taken", sub: "calendar" }. */
export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts.length === 0 || !isDestination(parts[0])) return DEFAULT_ROUTE;
  const dest = parts[0];
  if (dest === "taken" && parts[1] && isSubView(parts[1])) {
    return { dest, sub: parts[1] };
  }
  return { dest, sub: "list" };
}

export function toHash(route: Route): string {
  if (route.dest === "taken" && route.sub !== "list") {
    return `#/taken/${route.sub}`;
  }
  return `#/${route.dest}`;
}
