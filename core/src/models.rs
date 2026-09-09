use serde::{Deserialize, Serialize};

/// A row of `status` (spec §5). Serialises camelCase for the frontend DTO.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub position: i64,
    pub is_default: bool,
    pub is_done: bool,
    /// How many `todo` rows currently sit on this status. Filled by `list`.
    #[serde(default)]
    pub todo_count: i64,
}

/// Fields accepted when creating/updating a status. `id` is ignored on create.
/// The `is_default` and `is_done` markings are not part of the input: they are
/// seeded once and can only ever be renamed, never moved or cleared.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusInput {
    pub name: String,
    pub color: String,
}

/// The kenmerk types (spec §4). `type` is a reserved word, hence the rename.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AttributeType {
    Text,
    Number,
    Date,
    Select,
    Checkbox,
}

impl AttributeType {
    pub fn as_str(self) -> &'static str {
        match self {
            AttributeType::Text => "text",
            AttributeType::Number => "number",
            AttributeType::Date => "date",
            AttributeType::Select => "select",
            AttributeType::Checkbox => "checkbox",
        }
    }
    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "text" => AttributeType::Text,
            "number" => AttributeType::Number,
            "date" => AttributeType::Date,
            "select" => AttributeType::Select,
            "checkbox" => AttributeType::Checkbox,
            _ => return None,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AttributeScope {
    Global,
    Project,
}

/// A row of `attribute_definition` plus its option list and a usage count.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttributeDefinition {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub type_: AttributeType,
    pub scope: AttributeScope,
    /// Set iff `scope == project`.
    pub template_id: Option<i64>,
    pub select_multiple: bool,
    pub text_multiline: bool,
    pub number_unit: Option<String>,
    pub checkbox_default: bool,
    /// Options, ordered by `position`. Empty for non-select types.
    #[serde(default)]
    pub options: Vec<AttributeOption>,
    /// Distinct `todo` rows with at least one value for this kenmerk.
    #[serde(default)]
    pub value_count: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttributeOption {
    pub id: i64,
    pub attribute_id: i64,
    pub label: String,
    pub position: i64,
    /// Distinct `todo` rows referencing this option.
    #[serde(default)]
    pub value_count: i64,
}

/// Create/update payload for a kenmerk. `type_` is honoured only on create
/// (read-only afterwards, spec §4). `scope`/`template_id` set the bereik on
/// create; afterwards only `project -> global` is allowed via `set_scope`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttributeInput {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: AttributeType,
    #[serde(default = "default_scope")]
    pub scope: AttributeScope,
    #[serde(default)]
    pub template_id: Option<i64>,
    #[serde(default)]
    pub select_multiple: bool,
    #[serde(default)]
    pub text_multiline: bool,
    #[serde(default)]
    pub number_unit: Option<String>,
    #[serde(default)]
    pub checkbox_default: bool,
}

fn default_scope() -> AttributeScope {
    AttributeScope::Global
}

/// A row of `project_template` with lightweight counts.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectTemplate {
    pub id: i64,
    pub name: String,
    pub created_at: String,
    #[serde(default)]
    pub todo_count: i64,
    #[serde(default)]
    pub project_count: i64,
}

/// A row of `todo_template` plus its pre-set values and reminder definitions.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoTemplate {
    pub id: i64,
    pub template_id: i64,
    pub position: i64,
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub links: Vec<TemplateLink>,
    #[serde(default)]
    pub attribute_values: Vec<TemplateAttributeValue>,
    #[serde(default)]
    pub reminders: Vec<ReminderDefinition>,
}

/// A row of `todo_template_link` — mirrors `Link` but hangs off a sjabloontaak.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateLink {
    pub id: i64,
    pub todo_template_id: i64,
    pub url: String,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoTemplateInput {
    pub title: String,
    #[serde(default)]
    pub description: String,
}

/// One pre-set kenmerkwaarde on a sjabloontaak (`todo_template_attribute_value`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateAttributeValue {
    pub attribute_id: i64,
    #[serde(default)]
    pub value_text: Option<String>,
    #[serde(default)]
    pub value_number: Option<f64>,
    #[serde(default)]
    pub value_date: Option<String>,
    #[serde(default)]
    pub value_bool: Option<bool>,
    /// For `select`: the chosen option ids (0..n).
    #[serde(default)]
    pub option_ids: Vec<i64>,
}

/// A herinnering *definition* — the output of `ReminderPopover` and the shape
/// stored on a sjabloontaak. No `fire_at` (the herinneringen-engine resolves it).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderDefinition {
    /// Present when read back from a template; ignored on create.
    #[serde(default)]
    pub id: Option<i64>,
    pub mode: ReminderMode,
    // absolute
    #[serde(default)]
    pub fire_at_literal: Option<String>,
    // relative
    #[serde(default)]
    pub anchor: Option<ReminderAnchor>,
    #[serde(default)]
    pub basis: Option<ReminderBasis>,
    #[serde(default)]
    pub trigger_status_id: Option<i64>,
    #[serde(default)]
    pub offset_value: Option<i64>,
    #[serde(default)]
    pub offset_unit: Option<ReminderUnit>,
    #[serde(default)]
    pub offset_direction: Option<ReminderDirection>,
    #[serde(default)]
    pub fire_time: Option<String>,

    // --- runtime (de herinneringen-engine lost dit op; NULL / afwezig op een sjabloon) -------
    /// Opgelost lokaal vuurmoment, of `None` zolang het niet berekenbaar is.
    #[serde(default)]
    pub fire_at: Option<String>,
    /// Dedup-markering: gezet zodra de herinnering gevuurd is.
    #[serde(default)]
    pub fired_at: Option<String>,
    /// `true` als `fired_at` door de inhaalronde gezet is (→ toestand `late`).
    #[serde(default)]
    pub fired_late: bool,
    /// Per-herinnering "gezien"-bevestiging.
    #[serde(default)]
    pub seen_at: Option<String>,
    /// Afgeleide toestand (spec §6.3). Gevuld voor een echte taak-herinnering,
    /// `None` voor een sjabloondefinitie.
    #[serde(default)]
    pub state: Option<ReminderState>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReminderMode {
    Absolute,
    Relative,
}

/// De zeven herinnering-toestanden (spec §6.3), afgeleid — nooit opgeslagen.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReminderState {
    Pending,
    Waiting,
    Inactive,
    Fired,
    Late,
    Seen,
    Done,
}

impl ReminderState {
    pub fn as_str(self) -> &'static str {
        match self {
            ReminderState::Pending => "pending",
            ReminderState::Waiting => "waiting",
            ReminderState::Inactive => "inactive",
            ReminderState::Fired => "fired",
            ReminderState::Late => "late",
            ReminderState::Seen => "seen",
            ReminderState::Done => "done",
        }
    }
}

// ========================================================================
// Project & Taak (spec §1, §2)
// ========================================================================

/// The three projecttoestanden (spec §2.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProjectState {
    Active,
    Completed,
    Archived,
}

impl ProjectState {
    pub fn as_str(self) -> &'static str {
        match self {
            ProjectState::Active => "active",
            ProjectState::Completed => "completed",
            ProjectState::Archived => "archived",
        }
    }
    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "active" => ProjectState::Active,
            "completed" => ProjectState::Completed,
            "archived" => ProjectState::Archived,
            _ => return None,
        })
    }
}

/// A row of `project` plus derived progress counts (spec §2).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub template_id: Option<i64>,
    pub template_name: Option<String>,
    pub state: ProjectState,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub archived_at: Option<String>,
    /// Total tasks in the project.
    #[serde(default)]
    pub todo_count: i64,
    /// Tasks currently on the afgerond-status.
    #[serde(default)]
    pub done_count: i64,
}

/// Create payload for a project (spec §2 — sjabloon óf leeg, naam, kleur; geen startdatum).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectInput {
    pub name: String,
    pub color: String,
    #[serde(default)]
    pub template_id: Option<i64>,
}

/// A row of `todo` with its nested links, kenmerkwaarden and herinneringdefinities.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: i64,
    pub project_id: Option<i64>,
    pub position: Option<i64>,
    pub title: String,
    pub description: String,
    pub status_id: i64,
    pub deadline_date: Option<String>,
    pub deadline_time: Option<String>,
    pub created_at: String,
    #[serde(default)]
    pub links: Vec<Link>,
    #[serde(default)]
    pub attribute_values: Vec<TodoAttributeValue>,
    #[serde(default)]
    pub reminders: Vec<ReminderDefinition>,
}

/// A row of `link` (spec §1 — url of bestandspad + optionele titel, ongevalideerd).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Link {
    pub id: i64,
    pub todo_id: i64,
    pub url: String,
    pub title: Option<String>,
}

/// One kenmerkwaarde filled in on a real taak. `option_labels` resolves each
/// chosen option to its live label, falling back to `option_label_snapshot`.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoAttributeValue {
    pub attribute_id: i64,
    #[serde(default)]
    pub value_text: Option<String>,
    #[serde(default)]
    pub value_number: Option<f64>,
    #[serde(default)]
    pub value_date: Option<String>,
    /// Optioneel tijdstip ("HH:MM"), alleen zinvol samen met `value_date`.
    #[serde(default)]
    pub value_time: Option<String>,
    #[serde(default)]
    pub value_bool: Option<bool>,
    #[serde(default)]
    pub option_ids: Vec<i64>,
    #[serde(default)]
    pub option_labels: Vec<String>,
}

/// Create payload for a taak (spec §1.1 — snel toevoegen + volledig scherm).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTodoInput {
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub project_id: Option<i64>,
    /// Insert-before position within the project (1-based). `None` appends.
    #[serde(default)]
    pub position: Option<i64>,
    #[serde(default)]
    pub status_id: Option<i64>,
    #[serde(default)]
    pub deadline_date: Option<String>,
    #[serde(default)]
    pub deadline_time: Option<String>,
}

/// Patch payload for the taakdetailpaneel — title/omschrijving only; status,
/// deadline, project and volgorde have their own commands.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTodoInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

/// Result of `move_todo` — the moved taak plus the ids of kenmerken whose value
/// was cleared because the kenmerk belongs to another sjabloon (spec §1.2).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveTodoResult {
    pub todo: Todo,
    #[serde(default)]
    pub cleared_attribute_ids: Vec<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReminderAnchor {
    ThisTodo,
    PreviousTodo,
    NextTodo,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReminderBasis {
    Deadline,
    Status,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReminderUnit {
    Days,
    Hours,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReminderDirection {
    Before,
    After,
}

impl ReminderAnchor {
    pub fn as_str(self) -> &'static str {
        match self {
            ReminderAnchor::ThisTodo => "this_todo",
            ReminderAnchor::PreviousTodo => "previous_todo",
            ReminderAnchor::NextTodo => "next_todo",
        }
    }
}
impl ReminderBasis {
    pub fn as_str(self) -> &'static str {
        match self {
            ReminderBasis::Deadline => "deadline",
            ReminderBasis::Status => "status",
        }
    }
}
impl ReminderUnit {
    pub fn as_str(self) -> &'static str {
        match self {
            ReminderUnit::Days => "days",
            ReminderUnit::Hours => "hours",
        }
    }
}
impl ReminderDirection {
    pub fn as_str(self) -> &'static str {
        match self {
            ReminderDirection::Before => "before",
            ReminderDirection::After => "after",
        }
    }
}
