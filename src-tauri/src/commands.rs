//! Thin `#[tauri::command]` wrappers that delegate to `takenbeheer_core`.
//! Every command returns `Result<T, AppError>`; `AppError` serialises to
//! `{ code, message }` with a Dutch message. Features add their commands
//! here and register them in [`crate::generate_handler`].

use tauri::State;

use takenbeheer_core::clock::now_local_iso;
use takenbeheer_core::models::{
    AttributeInput, AttributeScope, CreateProjectInput, CreateTodoInput, ProjectState,
    ReminderDefinition, StatusInput, TemplateAttributeValue, TemplateLink, TodoAttributeValue,
    TodoTemplateInput, UpdateTodoInput,
};
use takenbeheer_core::{
    attributes, calendar, dashboard, onboarding, projects, settings, statuses, templates, todos,
    views, AppError, AttributeColumn, AttributeDefinition, AttributeOption, CalendarEvent,
    DashboardData, MoveTodoResult, OnboardingState, Project, ProjectTemplate, Status, Todo,
    TodoFilter, TodoTemplate, UserSettings, VisibleCount,
};

use crate::state::AppState;

type CmdResult<T> = Result<T, AppError>;

#[tauri::command]
pub fn get_user_settings(state: State<'_, AppState>) -> CmdResult<UserSettings> {
    state.db.with_conn(settings::get)
}

#[tauri::command]
pub fn set_user_settings(
    state: State<'_, AppState>,
    settings: UserSettings,
) -> CmdResult<UserSettings> {
    state.db.with_conn(|c| settings::set(c, settings.clone()))
}

// ---------------------------------------------------------------- statuses

#[tauri::command]
pub fn list_statuses(state: State<'_, AppState>) -> CmdResult<Vec<Status>> {
    state.db.with_conn(statuses::list)
}

#[tauri::command]
pub fn create_status(state: State<'_, AppState>, input: StatusInput) -> CmdResult<Status> {
    state.db.with_conn(|c| statuses::create(c, input.clone()))
}

#[tauri::command]
pub fn update_status(state: State<'_, AppState>, id: i64, input: StatusInput) -> CmdResult<Status> {
    state
        .db
        .with_conn(|c| statuses::update(c, id, input.clone()))
}

#[tauri::command]
pub fn delete_status(
    state: State<'_, AppState>,
    id: i64,
    reassign_to: Option<i64>,
) -> CmdResult<()> {
    let now = now_local_iso();
    state
        .db
        .with_conn(|c| statuses::delete(c, id, reassign_to, &now))
}

#[tauri::command]
pub fn reorder_statuses(state: State<'_, AppState>, ids: Vec<i64>) -> CmdResult<Vec<Status>> {
    state.db.with_conn(|c| statuses::reorder(c, &ids))
}

// -------------------------------------------------------------- kenmerken

#[tauri::command]
pub fn list_attributes(state: State<'_, AppState>) -> CmdResult<Vec<AttributeDefinition>> {
    state.db.with_conn(attributes::list)
}

#[tauri::command]
pub fn create_attribute(
    state: State<'_, AppState>,
    input: AttributeInput,
) -> CmdResult<AttributeDefinition> {
    let now = now_local_iso();
    state
        .db
        .with_conn(|c| attributes::create(c, input.clone(), &now))
}

#[tauri::command]
pub fn update_attribute(
    state: State<'_, AppState>,
    id: i64,
    input: AttributeInput,
) -> CmdResult<AttributeDefinition> {
    state
        .db
        .with_conn(|c| attributes::update(c, id, input.clone()))
}

#[tauri::command]
pub fn delete_attribute(state: State<'_, AppState>, id: i64) -> CmdResult<()> {
    state.db.with_conn(|c| attributes::delete(c, id))
}

#[tauri::command]
pub fn set_attribute_scope(
    state: State<'_, AppState>,
    id: i64,
    scope: AttributeScope,
) -> CmdResult<AttributeDefinition> {
    state.db.with_conn(|c| attributes::set_scope(c, id, scope))
}

#[tauri::command]
pub fn create_attribute_option(
    state: State<'_, AppState>,
    attribute_id: i64,
    label: String,
) -> CmdResult<AttributeOption> {
    state
        .db
        .with_conn(|c| attributes::create_option(c, attribute_id, &label))
}

#[tauri::command]
pub fn rename_attribute_option(
    state: State<'_, AppState>,
    option_id: i64,
    new_label: String,
    apply_to_existing: bool,
) -> CmdResult<AttributeOption> {
    state
        .db
        .with_conn(|c| attributes::rename_option(c, option_id, &new_label, apply_to_existing))
}

#[tauri::command]
pub fn delete_attribute_option(
    state: State<'_, AppState>,
    option_id: i64,
    clear_values: bool,
) -> CmdResult<()> {
    state
        .db
        .with_conn(|c| attributes::delete_option(c, option_id, clear_values))
}

#[tauri::command]
pub fn reorder_attribute_options(
    state: State<'_, AppState>,
    attribute_id: i64,
    ids: Vec<i64>,
) -> CmdResult<Vec<AttributeOption>> {
    state
        .db
        .with_conn(|c| attributes::reorder_options(c, attribute_id, &ids))
}

#[tauri::command]
pub fn todos_without_value(state: State<'_, AppState>, attribute_id: i64) -> CmdResult<Vec<i64>> {
    state
        .db
        .with_conn(|c| attributes::todos_without_value(c, attribute_id))
}

// --------------------------------------------------------------- sjablonen

#[tauri::command]
pub fn list_templates(state: State<'_, AppState>) -> CmdResult<Vec<ProjectTemplate>> {
    state.db.with_conn(templates::list)
}

#[tauri::command]
pub fn create_template(state: State<'_, AppState>, name: String) -> CmdResult<ProjectTemplate> {
    let now = now_local_iso();
    state.db.with_conn(|c| templates::create(c, &name, &now))
}

#[tauri::command]
pub fn update_template(
    state: State<'_, AppState>,
    id: i64,
    name: String,
) -> CmdResult<ProjectTemplate> {
    state.db.with_conn(|c| templates::update(c, id, &name))
}

#[tauri::command]
pub fn delete_template(state: State<'_, AppState>, id: i64) -> CmdResult<()> {
    state.db.with_conn(|c| templates::delete(c, id))
}

#[tauri::command]
pub fn list_template_todos(
    state: State<'_, AppState>,
    template_id: i64,
) -> CmdResult<Vec<TodoTemplate>> {
    state
        .db
        .with_conn(|c| templates::list_todos(c, template_id))
}

#[tauri::command]
pub fn create_template_todo(
    state: State<'_, AppState>,
    template_id: i64,
    input: TodoTemplateInput,
) -> CmdResult<TodoTemplate> {
    state
        .db
        .with_conn(|c| templates::create_todo(c, template_id, input.clone()))
}

#[tauri::command]
pub fn update_template_todo(
    state: State<'_, AppState>,
    id: i64,
    input: TodoTemplateInput,
) -> CmdResult<TodoTemplate> {
    state
        .db
        .with_conn(|c| templates::update_todo(c, id, input.clone()))
}

#[tauri::command]
pub fn delete_template_todo(state: State<'_, AppState>, id: i64) -> CmdResult<()> {
    state.db.with_conn(|c| templates::delete_todo(c, id))
}

#[tauri::command]
pub fn reorder_template_todos(
    state: State<'_, AppState>,
    template_id: i64,
    ids: Vec<i64>,
) -> CmdResult<Vec<TodoTemplate>> {
    state
        .db
        .with_conn(|c| templates::reorder_todos(c, template_id, &ids))
}

#[tauri::command]
pub fn set_template_todo_attribute_value(
    state: State<'_, AppState>,
    todo_template_id: i64,
    value: TemplateAttributeValue,
) -> CmdResult<Vec<TemplateAttributeValue>> {
    state
        .db
        .with_conn(|c| templates::set_todo_attribute_value(c, todo_template_id, value.clone()))
}

#[tauri::command]
pub fn create_template_todo_reminder(
    state: State<'_, AppState>,
    todo_template_id: i64,
    definition: ReminderDefinition,
) -> CmdResult<ReminderDefinition> {
    let now = now_local_iso();
    state.db.with_conn(|c| {
        templates::create_todo_reminder(c, todo_template_id, definition.clone(), &now)
    })
}

#[tauri::command]
pub fn update_template_todo_reminder(
    state: State<'_, AppState>,
    id: i64,
    definition: ReminderDefinition,
) -> CmdResult<ReminderDefinition> {
    state
        .db
        .with_conn(|c| templates::update_todo_reminder(c, id, definition.clone()))
}

#[tauri::command]
pub fn delete_template_todo_reminder(state: State<'_, AppState>, id: i64) -> CmdResult<()> {
    state
        .db
        .with_conn(|c| templates::delete_todo_reminder(c, id))
}

#[tauri::command]
pub fn add_template_todo_link(
    state: State<'_, AppState>,
    todo_template_id: i64,
    url: String,
    title: Option<String>,
) -> CmdResult<Vec<TemplateLink>> {
    state
        .db
        .with_conn(|c| templates::add_todo_link(c, todo_template_id, &url, title.as_deref()))
}

#[tauri::command]
pub fn update_template_todo_link(
    state: State<'_, AppState>,
    link_id: i64,
    url: String,
    title: Option<String>,
) -> CmdResult<Vec<TemplateLink>> {
    state
        .db
        .with_conn(|c| templates::update_todo_link(c, link_id, &url, title.as_deref()))
}

#[tauri::command]
pub fn delete_template_todo_link(state: State<'_, AppState>, link_id: i64) -> CmdResult<()> {
    state
        .db
        .with_conn(|c| templates::delete_todo_link(c, link_id))
}

// --------------------------------------------------------------- projecten

fn parse_states(states: Option<Vec<String>>) -> Vec<ProjectState> {
    states
        .unwrap_or_default()
        .iter()
        .filter_map(|s| ProjectState::parse(s))
        .collect()
}

#[tauri::command]
pub fn list_projects(
    state: State<'_, AppState>,
    states: Option<Vec<String>>,
) -> CmdResult<Vec<Project>> {
    let filter = parse_states(states);
    state.db.with_conn(|c| projects::list_projects(c, &filter))
}

#[tauri::command]
pub fn get_project(state: State<'_, AppState>, id: i64) -> CmdResult<Project> {
    state.db.with_conn(|c| projects::get_project(c, id))
}

#[tauri::command]
pub fn create_project(state: State<'_, AppState>, input: CreateProjectInput) -> CmdResult<Project> {
    let now = now_local_iso();
    state
        .db
        .with_conn(|c| projects::create_project(c, input.clone(), &now))
}

#[tauri::command]
pub fn update_project(
    state: State<'_, AppState>,
    id: i64,
    name: Option<String>,
    color: Option<String>,
) -> CmdResult<Project> {
    state
        .db
        .with_conn(|c| projects::update_project(c, id, name.as_deref(), color.as_deref()))
}

#[tauri::command]
pub fn duplicate_project(state: State<'_, AppState>, id: i64) -> CmdResult<Project> {
    let now = now_local_iso();
    state
        .db
        .with_conn(|c| projects::duplicate_project(c, id, &now))
}

#[tauri::command]
pub fn archive_project(state: State<'_, AppState>, id: i64) -> CmdResult<Project> {
    let now = now_local_iso();
    state
        .db
        .with_conn(|c| projects::archive_project(c, id, &now))
}

#[tauri::command]
pub fn unarchive_project(state: State<'_, AppState>, id: i64) -> CmdResult<Project> {
    let now = now_local_iso();
    state
        .db
        .with_conn(|c| projects::unarchive_project(c, id, &now))
}

#[tauri::command]
pub fn mark_project_completed(state: State<'_, AppState>, id: i64) -> CmdResult<Project> {
    let now = now_local_iso();
    state
        .db
        .with_conn(|c| projects::mark_project_completed(c, id, &now))
}

#[tauri::command]
pub fn delete_project(state: State<'_, AppState>, id: i64, typed_name: String) -> CmdResult<()> {
    state
        .db
        .with_conn(|c| projects::delete_project(c, id, &typed_name))
}

// ------------------------------------------------------------------- taken

#[tauri::command]
pub fn list_todos(
    state: State<'_, AppState>,
    project_id: Option<i64>,
    loose_only: Option<bool>,
    include_archived: Option<bool>,
) -> CmdResult<Vec<Todo>> {
    state.db.with_conn(|c| {
        todos::list_todos(
            c,
            project_id,
            loose_only.unwrap_or(false),
            include_archived.unwrap_or(false),
        )
    })
}

#[tauri::command]
pub fn get_todo(state: State<'_, AppState>, id: i64) -> CmdResult<Todo> {
    state.db.with_conn(|c| todos::get_todo(c, id))
}

#[tauri::command]
pub fn create_todo(state: State<'_, AppState>, input: CreateTodoInput) -> CmdResult<Todo> {
    let now = now_local_iso();
    state
        .db
        .with_conn(|c| todos::create_todo(c, input.clone(), &now))
}

#[tauri::command]
pub fn update_todo(state: State<'_, AppState>, id: i64, input: UpdateTodoInput) -> CmdResult<Todo> {
    state
        .db
        .with_conn(|c| todos::update_todo(c, id, input.clone()))
}

#[tauri::command]
pub fn set_todo_status(
    state: State<'_, AppState>,
    todo_id: i64,
    status_id: i64,
) -> CmdResult<Todo> {
    let now = now_local_iso();
    state
        .db
        .with_conn(|c| todos::set_todo_status(c, todo_id, status_id, &now))
}

#[tauri::command]
pub fn set_todo_deadline(
    state: State<'_, AppState>,
    todo_id: i64,
    date: Option<String>,
    time: Option<String>,
) -> CmdResult<Todo> {
    let now = now_local_iso();
    state
        .db
        .with_conn(|c| todos::set_todo_deadline(c, todo_id, date.as_deref(), time.as_deref(), &now))
}

#[tauri::command]
pub fn reorder_todos(
    state: State<'_, AppState>,
    project_id: i64,
    ids: Vec<i64>,
) -> CmdResult<Vec<Todo>> {
    let now = now_local_iso();
    state
        .db
        .with_conn(|c| todos::reorder_todos(c, project_id, &ids, &now))
}

#[tauri::command]
pub fn move_todo(
    state: State<'_, AppState>,
    todo_id: i64,
    target_project_id: Option<i64>,
) -> CmdResult<MoveTodoResult> {
    let now = now_local_iso();
    state
        .db
        .with_conn(|c| todos::move_todo(c, todo_id, target_project_id, &now))
}

#[tauri::command]
pub fn duplicate_todo(state: State<'_, AppState>, id: i64) -> CmdResult<Todo> {
    let now = now_local_iso();
    state.db.with_conn(|c| todos::duplicate_todo(c, id, &now))
}

#[tauri::command]
pub fn delete_todo(state: State<'_, AppState>, id: i64) -> CmdResult<()> {
    let now = now_local_iso();
    state.db.with_conn(|c| todos::delete_todo(c, id, &now))
}

#[tauri::command]
pub fn add_todo_link(
    state: State<'_, AppState>,
    todo_id: i64,
    url: String,
    title: Option<String>,
) -> CmdResult<Todo> {
    state
        .db
        .with_conn(|c| todos::add_link(c, todo_id, &url, title.as_deref()))
}

#[tauri::command]
pub fn update_todo_link(
    state: State<'_, AppState>,
    link_id: i64,
    url: String,
    title: Option<String>,
) -> CmdResult<Todo> {
    state
        .db
        .with_conn(|c| todos::update_link(c, link_id, &url, title.as_deref()))
}

#[tauri::command]
pub fn remove_todo_link(state: State<'_, AppState>, link_id: i64) -> CmdResult<Option<Todo>> {
    state.db.with_conn(|c| todos::remove_link(c, link_id))
}

#[tauri::command]
pub fn set_todo_attribute_value(
    state: State<'_, AppState>,
    todo_id: i64,
    value: TodoAttributeValue,
) -> CmdResult<Todo> {
    let now = now_local_iso();
    state
        .db
        .with_conn(|c| todos::set_todo_attribute_value(c, todo_id, value.clone(), &now))
}

#[tauri::command]
pub fn create_todo_reminder(
    state: State<'_, AppState>,
    todo_id: i64,
    definition: ReminderDefinition,
) -> CmdResult<Todo> {
    let now = now_local_iso();
    state
        .db
        .with_conn(|c| todos::create_reminder(c, todo_id, definition.clone(), &now))
}

#[tauri::command]
pub fn update_todo_reminder(
    state: State<'_, AppState>,
    id: i64,
    definition: ReminderDefinition,
) -> CmdResult<Todo> {
    state
        .db
        .with_conn(|c| todos::update_reminder(c, id, definition.clone()))
}

#[tauri::command]
pub fn delete_todo_reminder(state: State<'_, AppState>, id: i64) -> CmdResult<Option<Todo>> {
    state.db.with_conn(|c| todos::delete_reminder(c, id))
}

/// Bring the window forward and open a taak in the detail panel — the handler a
/// notification click routes through. Also used from the tray.
#[tauri::command]
pub fn open_reminder_todo(app: tauri::AppHandle, todo_id: i64) {
    crate::background::focus_and_open(&app, todo_id);
}

// ------------------------------------------------------ takenviews

/// The gedeelde filter + zoekterm toegepast — voedt Lijst, Tabel en Kanban
/// (spec §8.1, §8.2).
#[tauri::command]
pub fn list_todos_view(
    state: State<'_, AppState>,
    filter: Option<TodoFilter>,
    search: Option<String>,
) -> CmdResult<Vec<Todo>> {
    let now = now_local_iso();
    let filter = filter.unwrap_or_default();
    let search = search.unwrap_or_default();
    state
        .db
        .with_conn(|c| views::list_todos_filtered(c, &filter, &search, &now))
}

/// De voetbalk-tellingen (`N van M`, `N te laat`) voor de zichtbare set.
#[tauri::command]
pub fn count_visible_and_late(
    state: State<'_, AppState>,
    filter: Option<TodoFilter>,
    search: Option<String>,
) -> CmdResult<VisibleCount> {
    let now = now_local_iso();
    let filter = filter.unwrap_or_default();
    let search = search.unwrap_or_default();
    state
        .db
        .with_conn(|c| views::count_visible_and_late(c, &filter, &search, &now))
}

/// De dynamische kenmerkkolommen voor de Tabel.
#[tauri::command]
pub fn list_attribute_columns(state: State<'_, AppState>) -> CmdResult<Vec<AttributeColumn>> {
    state.db.with_conn(views::list_attribute_columns)
}

/// Bulk-statuswissel over een selectie (bulkbalk). Delegeert per taak.
#[tauri::command]
pub fn bulk_set_todo_status(
    state: State<'_, AppState>,
    ids: Vec<i64>,
    status_id: i64,
) -> CmdResult<()> {
    let now = now_local_iso();
    state
        .db
        .with_conn(|c| views::bulk_set_status(c, &ids, status_id, &now))
}

/// Bulk-deadline over een selectie (bulkbalk). `date: None` wist de deadline.
#[tauri::command]
pub fn bulk_set_todo_deadline(
    state: State<'_, AppState>,
    ids: Vec<i64>,
    date: Option<String>,
    time: Option<String>,
) -> CmdResult<()> {
    let now = now_local_iso();
    state
        .db
        .with_conn(|c| views::bulk_set_deadline(c, &ids, date.as_deref(), time.as_deref(), &now))
}

/// Bulk-verwijderen over een selectie (bulkbalk, met bevestiging in de UI).
#[tauri::command]
pub fn bulk_delete_todos(state: State<'_, AppState>, ids: Vec<i64>) -> CmdResult<()> {
    let now = now_local_iso();
    state.db.with_conn(|c| views::bulk_delete(c, &ids, &now))
}

/// De view-lokale voorkeuren (sort/group/kolommen) voor één view.
#[tauri::command]
pub fn get_view_prefs(state: State<'_, AppState>, view: String) -> CmdResult<serde_json::Value> {
    state.db.with_conn(|c| views::get_view_prefs(c, &view))
}

// -------------------------------------------------- dashboard

/// De volledige dashboard-snapshot: late-banner + de drie blokken.
#[tauri::command]
pub fn dashboard_snapshot(state: State<'_, AppState>) -> CmdResult<DashboardData> {
    let now = now_local_iso();
    state
        .db
        .with_conn(|c| dashboard::dashboard_snapshot(c, &now))
}

/// "Markeer als gezien" voor de hele banner — elke nu-late herinnering op `seen`.
#[tauri::command]
pub fn mark_all_late_seen(state: State<'_, AppState>) -> CmdResult<usize> {
    let now = now_local_iso();
    state
        .db
        .with_conn(|c| dashboard::mark_all_late_seen(c, &now))
}

/// "Markeer als gezien" voor één herinneringsrij.
#[tauri::command]
pub fn mark_reminder_seen(state: State<'_, AppState>, reminder_id: i64) -> CmdResult<()> {
    let now = now_local_iso();
    state
        .db
        .with_conn(|c| dashboard::mark_reminder_seen(c, reminder_id, &now))
}

// --------------------------------------------------- kalender

/// Deadline- én herinneringsevents binnen `[from, to]` (datums "YYYY-MM-DD"),
/// met de gedeelde filter toegepast en gearchiveerde projecten uitgesloten.
#[tauri::command]
pub fn calendar_events(
    state: State<'_, AppState>,
    from: String,
    to: String,
    filter: Option<TodoFilter>,
    search: Option<String>,
) -> CmdResult<Vec<CalendarEvent>> {
    let now = now_local_iso();
    let filter = filter.unwrap_or_default();
    let search = search.unwrap_or_default();
    state
        .db
        .with_conn(|c| calendar::calendar_events(c, &from, &to, &filter, &search, &now))
}

// ------------------------------------------------- onboarding

/// De driestapsonboarding-toestand, afgeleid uit de tellingen.
#[tauri::command]
pub fn onboarding_state(state: State<'_, AppState>) -> CmdResult<OnboardingState> {
    state.db.with_conn(onboarding::onboarding_state)
}

#[tauri::command]
pub fn set_view_prefs(
    state: State<'_, AppState>,
    view: String,
    prefs: serde_json::Value,
) -> CmdResult<serde_json::Value> {
    state
        .db
        .with_conn(|c| views::set_view_prefs(c, &view, prefs.clone()))
}
