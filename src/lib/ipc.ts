import { invoke as tauriInvoke } from "@tauri-apps/api/core";

/**
 * The serde-serialised error every `#[tauri::command]` rejects with
 * (see src-tauri/../core::AppError). `code` is a stable machine string;
 * `message` is a ready-to-show Dutch sentence.
 */
export interface AppError {
  code: string;
  message: string;
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    typeof (value as AppError).message === "string"
  );
}

/**
 * The IPC surface. Each feature adds its commands here as
 * `"command_name": { args: {...}; result: T }` so call sites stay typed.
 */
type S = import("./statusTypes").Status;
type A = import("./beheerTypes").AttributeDefinition;
type AO = import("./beheerTypes").AttributeOption;
type PT = import("./beheerTypes").ProjectTemplate;
type TT = import("./beheerTypes").TodoTemplate;
type TAV = import("./beheerTypes").TemplateAttributeValue;
type RD = import("./beheerTypes").ReminderDefinition;
type P = import("./taskTypes").Project;
type PState = import("./taskTypes").ProjectState;
type CPI = import("./taskTypes").CreateProjectInput;
type TD = import("./taskTypes").Todo;
type CTI = import("./taskTypes").CreateTodoInput;
type UTI = import("./taskTypes").UpdateTodoInput;
type MTR = import("./taskTypes").MoveTodoResult;
type TDAV = import("./taskTypes").TodoAttributeValue;

export interface Commands {
  get_user_settings: {
    args: Record<string, never>;
    result: import("./settings").UserSettings;
  };
  set_user_settings: {
    args: { settings: import("./settings").UserSettings };
    result: import("./settings").UserSettings;
  };

  // --- statuses ---
  list_statuses: { args: Record<string, never>; result: S[] };
  create_status: { args: { input: import("./beheerTypes").StatusInput }; result: S };
  update_status: {
    args: { id: number; input: import("./beheerTypes").StatusInput };
    result: S;
  };
  delete_status: { args: { id: number; reassignTo?: number | null }; result: null };
  reorder_statuses: { args: { ids: number[] }; result: S[] };

  // --- kenmerken ---
  list_attributes: { args: Record<string, never>; result: A[] };
  create_attribute: {
    args: { input: import("./beheerTypes").AttributeInput };
    result: A;
  };
  update_attribute: {
    args: { id: number; input: import("./beheerTypes").AttributeInput };
    result: A;
  };
  delete_attribute: { args: { id: number }; result: null };
  set_attribute_scope: {
    args: { id: number; scope: import("./beheerTypes").AttributeScope };
    result: A;
  };
  create_attribute_option: {
    args: { attributeId: number; label: string };
    result: AO;
  };
  rename_attribute_option: {
    args: { optionId: number; newLabel: string; applyToExisting: boolean };
    result: AO;
  };
  delete_attribute_option: {
    args: { optionId: number; clearValues: boolean };
    result: null;
  };
  reorder_attribute_options: {
    args: { attributeId: number; ids: number[] };
    result: AO[];
  };
  todos_without_value: { args: { attributeId: number }; result: number[] };

  // --- sjablonen ---
  list_templates: { args: Record<string, never>; result: PT[] };
  create_template: { args: { name: string }; result: PT };
  update_template: { args: { id: number; name: string }; result: PT };
  delete_template: { args: { id: number }; result: null };
  list_template_todos: { args: { templateId: number }; result: TT[] };
  create_template_todo: {
    args: { templateId: number; input: import("./beheerTypes").TodoTemplateInput };
    result: TT;
  };
  update_template_todo: {
    args: { id: number; input: import("./beheerTypes").TodoTemplateInput };
    result: TT;
  };
  delete_template_todo: { args: { id: number }; result: null };
  reorder_template_todos: {
    args: { templateId: number; ids: number[] };
    result: TT[];
  };
  set_template_todo_attribute_value: {
    args: { todoTemplateId: number; value: TAV };
    result: TAV[];
  };
  create_template_todo_reminder: {
    args: { todoTemplateId: number; definition: RD };
    result: RD;
  };
  update_template_todo_reminder: {
    args: { id: number; definition: RD };
    result: RD;
  };
  delete_template_todo_reminder: { args: { id: number }; result: null };
  add_template_todo_link: {
    args: { todoTemplateId: number; url: string; title?: string | null };
    result: import("./beheerTypes").TemplateLink[];
  };
  update_template_todo_link: {
    args: { linkId: number; url: string; title?: string | null };
    result: import("./beheerTypes").TemplateLink[];
  };
  delete_template_todo_link: { args: { linkId: number }; result: null };

  // --- projecten ---
  list_projects: { args: { states?: PState[] }; result: P[] };
  get_project: { args: { id: number }; result: P };
  create_project: { args: { input: CPI }; result: P };
  update_project: {
    args: { id: number; name?: string | null; color?: string | null };
    result: P;
  };
  duplicate_project: { args: { id: number }; result: P };
  archive_project: { args: { id: number }; result: P };
  unarchive_project: { args: { id: number }; result: P };
  mark_project_completed: { args: { id: number }; result: P };
  delete_project: { args: { id: number; typedName: string }; result: null };

  // --- taken ---
  list_todos: {
    args: {
      projectId?: number | null;
      looseOnly?: boolean;
      includeArchived?: boolean;
    };
    result: TD[];
  };
  get_todo: { args: { id: number }; result: TD };
  create_todo: { args: { input: CTI }; result: TD };
  update_todo: { args: { id: number; input: UTI }; result: TD };
  set_todo_status: { args: { todoId: number; statusId: number }; result: TD };
  set_todo_deadline: {
    args: { todoId: number; date?: string | null; time?: string | null };
    result: TD;
  };
  reorder_todos: { args: { projectId: number; ids: number[] }; result: TD[] };
  move_todo: {
    args: { todoId: number; targetProjectId?: number | null };
    result: MTR;
  };
  duplicate_todo: { args: { id: number }; result: TD };
  delete_todo: { args: { id: number }; result: null };
  add_todo_link: {
    args: { todoId: number; url: string; title?: string | null };
    result: TD;
  };
  update_todo_link: {
    args: { linkId: number; url: string; title?: string | null };
    result: TD;
  };
  remove_todo_link: { args: { linkId: number }; result: TD | null };
  set_todo_attribute_value: {
    args: { todoId: number; value: TDAV };
    result: TD;
  };
  create_todo_reminder: {
    args: { todoId: number; definition: RD };
    result: TD;
  };
  update_todo_reminder: { args: { id: number; definition: RD }; result: TD };
  delete_todo_reminder: { args: { id: number }; result: TD | null };

  // --- takenviews ---
  list_todos_view: {
    args: {
      filter?: import("./viewTypes").TodoFilter | null;
      search?: string | null;
    };
    result: TD[];
  };
  count_visible_and_late: {
    args: {
      filter?: import("./viewTypes").TodoFilter | null;
      search?: string | null;
    };
    result: import("./viewTypes").VisibleCount;
  };
  list_attribute_columns: {
    args: Record<string, never>;
    result: import("./viewTypes").AttributeColumn[];
  };
  bulk_set_todo_status: { args: { ids: number[]; statusId: number }; result: null };
  bulk_set_todo_deadline: {
    args: { ids: number[]; date?: string | null; time?: string | null };
    result: null;
  };
  bulk_delete_todos: { args: { ids: number[] }; result: null };
  get_view_prefs: { args: { view: string }; result: unknown };
  set_view_prefs: { args: { view: string; prefs: unknown }; result: unknown };

  // --- dashboard / kalender / onboarding / update ---
  dashboard_snapshot: {
    args: Record<string, never>;
    result: import("./dashboardTypes").DashboardData;
  };
  mark_all_late_seen: { args: Record<string, never>; result: number };
  mark_reminder_seen: { args: { reminderId: number }; result: null };
  calendar_events: {
    args: {
      from: string;
      to: string;
      filter?: import("./viewTypes").TodoFilter | null;
      search?: string | null;
    };
    result: import("./dashboardTypes").CalendarEvent[];
  };
  onboarding_state: {
    args: Record<string, never>;
    result: import("./dashboardTypes").OnboardingState;
  };
  confirm_update: { args: Record<string, never>; result: null };
}

export type CommandName = keyof Commands;

/** Typed `invoke`. Rejections are normalised to {@link AppError}. */
export async function invoke<K extends CommandName>(
  command: K,
  args: Commands[K]["args"],
): Promise<Commands[K]["result"]> {
  try {
    return await tauriInvoke<Commands[K]["result"]>(command, args);
  } catch (raw) {
    if (isAppError(raw)) throw raw;
    throw {
      code: "unknown",
      message: typeof raw === "string" ? raw : "Er ging iets mis.",
    } satisfies AppError;
  }
}
