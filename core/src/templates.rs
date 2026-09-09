//! Projectsjabloon (`project_template`) + sjabloontaak (`todo_template`) CRUD,
//! ordering, pre-set kenmerkwaarden and herinneringdefinities (spec §3).
//!
//! A sjabloon only carries a `name` (the name *is* the type). Sjabloontaken
//! have `title` / `description` / `position` and no deadline. Later edits to a
//! sjabloon do not touch existing projects — the instantiation reads
//! a snapshot.

use rusqlite::{params, Connection, OptionalExtension};

use crate::error::{AppError, AppResult};
use crate::models::{
    ProjectTemplate, ReminderDefinition, ReminderMode, TemplateAttributeValue, TemplateLink,
    TodoTemplate, TodoTemplateInput,
};

/// One raw `todo_template_attribute_value` row: `(attribute_id, text, number,
/// date, bool, option_id)`. Folded into `TemplateAttributeValue` by
/// `list_todo_attribute_values`.
type TemplateAttrValueRow = (
    i64,
    Option<String>,
    Option<f64>,
    Option<String>,
    Option<i64>,
    Option<i64>,
);

// --- project_template -----------------------------------------------------

pub fn list(conn: &Connection) -> AppResult<Vec<ProjectTemplate>> {
    let mut stmt = conn.prepare(
        "SELECT pt.id, pt.name, pt.created_at,
                (SELECT COUNT(*) FROM todo_template tt WHERE tt.template_id = pt.id),
                (SELECT COUNT(*) FROM project p WHERE p.template_id = pt.id)
         FROM project_template pt
         ORDER BY pt.name",
    )?;
    let rows = stmt
        .query_map([], |r| {
            Ok(ProjectTemplate {
                id: r.get(0)?,
                name: r.get(1)?,
                created_at: r.get(2)?,
                todo_count: r.get(3)?,
                project_count: r.get(4)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(rows)
}

pub fn get(conn: &Connection, id: i64) -> AppResult<ProjectTemplate> {
    list(conn)?
        .into_iter()
        .find(|t| t.id == id)
        .ok_or_else(|| not_found(id))
}

pub fn create(conn: &Connection, name: &str, now: &str) -> AppResult<ProjectTemplate> {
    if name.trim().is_empty() {
        return Err(AppError::new(
            "template_name_empty",
            "Geef het sjabloon een naam.",
        ));
    }
    conn.execute(
        "INSERT INTO project_template (name, created_at) VALUES (?1, ?2)",
        params![name.trim(), now],
    )?;
    get(conn, conn.last_insert_rowid())
}

pub fn update(conn: &Connection, id: i64, name: &str) -> AppResult<ProjectTemplate> {
    if name.trim().is_empty() {
        return Err(AppError::new(
            "template_name_empty",
            "Geef het sjabloon een naam.",
        ));
    }
    let affected = conn.execute(
        "UPDATE project_template SET name = ?1 WHERE id = ?2",
        params![name.trim(), id],
    )?;
    if affected == 0 {
        return Err(not_found(id));
    }
    get(conn, id)
}

pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    let affected = conn.execute("DELETE FROM project_template WHERE id = ?1", params![id])?;
    if affected == 0 {
        return Err(not_found(id));
    }
    Ok(())
}

// --- todo_template ------------------------------------------------------

pub fn list_todos(conn: &Connection, template_id: i64) -> AppResult<Vec<TodoTemplate>> {
    let mut stmt = conn.prepare(
        "SELECT id, template_id, position, title, description
         FROM todo_template WHERE template_id = ?1 ORDER BY position",
    )?;
    let mut todos: Vec<TodoTemplate> = stmt
        .query_map(params![template_id], |r| {
            Ok(TodoTemplate {
                id: r.get(0)?,
                template_id: r.get(1)?,
                position: r.get(2)?,
                title: r.get(3)?,
                description: r.get(4)?,
                links: Vec::new(),
                attribute_values: Vec::new(),
                reminders: Vec::new(),
            })
        })?
        .collect::<Result<_, _>>()?;

    for todo in &mut todos {
        todo.links = list_todo_links(conn, todo.id)?;
        todo.attribute_values = list_todo_attribute_values(conn, todo.id)?;
        todo.reminders = list_todo_reminders(conn, todo.id)?;
    }
    Ok(todos)
}

pub fn create_todo(
    conn: &Connection,
    template_id: i64,
    input: TodoTemplateInput,
) -> AppResult<TodoTemplate> {
    if input.title.trim().is_empty() {
        return Err(AppError::new(
            "template_todo_title_empty",
            "Geef de taak een titel.",
        ));
    }
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM project_template WHERE id = ?1",
            params![template_id],
            |_| Ok(true),
        )
        .optional()?
        .unwrap_or(false);
    if !exists {
        return Err(not_found(template_id));
    }
    let next_pos: i64 = conn.query_row(
        "SELECT COALESCE(MAX(position), 0) + 1 FROM todo_template WHERE template_id = ?1",
        params![template_id],
        |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO todo_template (template_id, position, title, description)
         VALUES (?1, ?2, ?3, ?4)",
        params![
            template_id,
            next_pos,
            input.title.trim(),
            input.description.trim()
        ],
    )?;
    let id = conn.last_insert_rowid();
    Ok(list_todos(conn, template_id)?
        .into_iter()
        .find(|t| t.id == id)
        .expect("just inserted"))
}

pub fn update_todo(
    conn: &Connection,
    id: i64,
    input: TodoTemplateInput,
) -> AppResult<TodoTemplate> {
    if input.title.trim().is_empty() {
        return Err(AppError::new(
            "template_todo_title_empty",
            "Geef de taak een titel.",
        ));
    }
    let affected = conn.execute(
        "UPDATE todo_template SET title = ?1, description = ?2 WHERE id = ?3",
        params![input.title.trim(), input.description.trim(), id],
    )?;
    if affected == 0 {
        return Err(todo_not_found(id));
    }
    let template_id: i64 = conn.query_row(
        "SELECT template_id FROM todo_template WHERE id = ?1",
        params![id],
        |r| r.get(0),
    )?;
    Ok(list_todos(conn, template_id)?
        .into_iter()
        .find(|t| t.id == id)
        .expect("just updated"))
}

pub fn delete_todo(conn: &Connection, id: i64) -> AppResult<()> {
    let template_id: Option<i64> = conn
        .query_row(
            "SELECT template_id FROM todo_template WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .optional()?;
    let template_id = template_id.ok_or_else(|| todo_not_found(id))?;
    conn.execute("DELETE FROM todo_template WHERE id = ?1", params![id])?;
    renumber_todos(conn, template_id)
}

pub fn reorder_todos(
    conn: &Connection,
    template_id: i64,
    ids_in_order: &[i64],
) -> AppResult<Vec<TodoTemplate>> {
    let current: Vec<i64> = list_todos(conn, template_id)?
        .iter()
        .map(|t| t.id)
        .collect();
    if ids_in_order.len() != current.len() || !current.iter().all(|id| ids_in_order.contains(id)) {
        return Err(AppError::new(
            "template_todo_reorder_mismatch",
            "De doorgegeven volgorde komt niet overeen met de bestaande taken.",
        ));
    }
    let tx = conn.unchecked_transaction()?;
    for id in ids_in_order {
        tx.execute(
            "UPDATE todo_template SET position = position + 100000 WHERE id = ?1",
            params![id],
        )?;
    }
    for (i, id) in ids_in_order.iter().enumerate() {
        tx.execute(
            "UPDATE todo_template SET position = ?1 WHERE id = ?2",
            params![i as i64 + 1, id],
        )?;
    }
    tx.commit()?;
    list_todos(conn, template_id)
}

// --- links op een sjabloontaak --------------------------------------

fn list_todo_links(conn: &Connection, todo_template_id: i64) -> AppResult<Vec<TemplateLink>> {
    let mut stmt = conn.prepare(
        "SELECT id, todo_template_id, url, title
         FROM todo_template_link WHERE todo_template_id = ?1 ORDER BY id",
    )?;
    let rows = stmt
        .query_map(params![todo_template_id], |r| {
            Ok(TemplateLink {
                id: r.get(0)?,
                todo_template_id: r.get(1)?,
                url: r.get(2)?,
                title: r.get(3)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(rows)
}

pub fn add_todo_link(
    conn: &Connection,
    todo_template_id: i64,
    url: &str,
    title: Option<&str>,
) -> AppResult<Vec<TemplateLink>> {
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM todo_template WHERE id = ?1",
            params![todo_template_id],
            |_| Ok(true),
        )
        .optional()?
        .unwrap_or(false);
    if !exists {
        return Err(todo_not_found(todo_template_id));
    }
    if url.trim().is_empty() {
        return Err(AppError::new(
            "link_url_empty",
            "Geef een URL of een bestandspad op.",
        ));
    }
    conn.execute(
        "INSERT INTO todo_template_link (todo_template_id, url, title) VALUES (?1, ?2, ?3)",
        params![
            todo_template_id,
            url.trim(),
            title.map(str::trim).filter(|s| !s.is_empty())
        ],
    )?;
    list_todo_links(conn, todo_template_id)
}

pub fn update_todo_link(
    conn: &Connection,
    link_id: i64,
    url: &str,
    title: Option<&str>,
) -> AppResult<Vec<TemplateLink>> {
    if url.trim().is_empty() {
        return Err(AppError::new(
            "link_url_empty",
            "Geef een URL of een bestandspad op.",
        ));
    }
    let todo_template_id: Option<i64> = conn
        .query_row(
            "SELECT todo_template_id FROM todo_template_link WHERE id = ?1",
            params![link_id],
            |r| r.get(0),
        )
        .optional()?;
    let todo_template_id = todo_template_id.ok_or_else(|| template_link_not_found(link_id))?;
    conn.execute(
        "UPDATE todo_template_link SET url = ?1, title = ?2 WHERE id = ?3",
        params![
            url.trim(),
            title.map(str::trim).filter(|s| !s.is_empty()),
            link_id
        ],
    )?;
    list_todo_links(conn, todo_template_id)
}

pub fn delete_todo_link(conn: &Connection, link_id: i64) -> AppResult<()> {
    let affected = conn.execute(
        "DELETE FROM todo_template_link WHERE id = ?1",
        params![link_id],
    )?;
    if affected == 0 {
        return Err(template_link_not_found(link_id));
    }
    Ok(())
}

// --- pre-set kenmerkwaarden -------------------------------------------

fn list_todo_attribute_values(
    conn: &Connection,
    todo_template_id: i64,
) -> AppResult<Vec<TemplateAttributeValue>> {
    let mut stmt = conn.prepare(
        "SELECT attribute_id, value_text, value_number, value_date, value_bool, option_id
         FROM todo_template_attribute_value
         WHERE todo_template_id = ?1
         ORDER BY attribute_id, id",
    )?;
    let raw: Vec<TemplateAttrValueRow> = stmt
        .query_map(params![todo_template_id], |r| {
            Ok((
                r.get(0)?,
                r.get(1)?,
                r.get(2)?,
                r.get(3)?,
                r.get(4)?,
                r.get(5)?,
            ))
        })?
        .collect::<Result<_, _>>()?;

    let mut out: Vec<TemplateAttributeValue> = Vec::new();
    for (attribute_id, text, number, date, bool_, option_id) in raw {
        match out.iter_mut().find(|v| v.attribute_id == attribute_id) {
            Some(existing) => {
                if let Some(oid) = option_id {
                    existing.option_ids.push(oid);
                }
            }
            None => out.push(TemplateAttributeValue {
                attribute_id,
                value_text: text,
                value_number: number,
                value_date: date,
                value_bool: bool_.map(|b| b != 0),
                option_ids: option_id.into_iter().collect(),
            }),
        }
    }
    Ok(out)
}

/// Replace the pre-set value for one kenmerk on one sjabloontaak. A scalar
/// value with every field empty (and no options) clears the setting.
pub fn set_todo_attribute_value(
    conn: &Connection,
    todo_template_id: i64,
    value: TemplateAttributeValue,
) -> AppResult<Vec<TemplateAttributeValue>> {
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "DELETE FROM todo_template_attribute_value
         WHERE todo_template_id = ?1 AND attribute_id = ?2",
        params![todo_template_id, value.attribute_id],
    )?;

    if !value.option_ids.is_empty() {
        for oid in &value.option_ids {
            tx.execute(
                "INSERT INTO todo_template_attribute_value
                    (todo_template_id, attribute_id, option_id)
                 VALUES (?1, ?2, ?3)",
                params![todo_template_id, value.attribute_id, oid],
            )?;
        }
    } else {
        let has_scalar = value
            .value_text
            .as_deref()
            .map(str::trim)
            .is_some_and(|s| !s.is_empty())
            || value.value_number.is_some()
            || value.value_date.is_some()
            || value.value_bool.is_some();
        if has_scalar {
            tx.execute(
                "INSERT INTO todo_template_attribute_value
                    (todo_template_id, attribute_id, value_text, value_number, value_date, value_bool)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    todo_template_id,
                    value.attribute_id,
                    value.value_text.as_deref().map(str::trim).filter(|s| !s.is_empty()),
                    value.value_number,
                    value.value_date,
                    value.value_bool.map(|b| b as i64),
                ],
            )?;
        }
    }
    tx.commit()?;
    list_todo_attribute_values(conn, todo_template_id)
}

// --- herinneringdefinities op een sjabloontaak -----------------------

fn list_todo_reminders(
    conn: &Connection,
    todo_template_id: i64,
) -> AppResult<Vec<ReminderDefinition>> {
    let mut stmt = conn.prepare(
        "SELECT id, mode, fire_at_literal, anchor, basis, trigger_status_id,
                offset_value, offset_unit, offset_direction, fire_time
         FROM todo_template_reminder
         WHERE todo_template_id = ?1
         ORDER BY id",
    )?;
    let rows = stmt
        .query_map(params![todo_template_id], |r| {
            let mode_str: String = r.get(1)?;
            Ok(ReminderDefinition {
                id: Some(r.get(0)?),
                mode: if mode_str == "absolute" {
                    ReminderMode::Absolute
                } else {
                    ReminderMode::Relative
                },
                fire_at_literal: r.get(2)?,
                anchor: r
                    .get::<_, Option<String>>(3)?
                    .and_then(|s| serde_json::from_value(serde_json::Value::String(s)).ok()),
                basis: r
                    .get::<_, Option<String>>(4)?
                    .and_then(|s| serde_json::from_value(serde_json::Value::String(s)).ok()),
                trigger_status_id: r.get(5)?,
                offset_value: r.get(6)?,
                offset_unit: r
                    .get::<_, Option<String>>(7)?
                    .and_then(|s| serde_json::from_value(serde_json::Value::String(s)).ok()),
                offset_direction: r
                    .get::<_, Option<String>>(8)?
                    .and_then(|s| serde_json::from_value(serde_json::Value::String(s)).ok()),
                fire_time: r.get(9)?,
                // Een sjabloondefinitie heeft geen runtime.
                fire_at: None,
                fired_at: None,
                fired_late: false,
                seen_at: None,
                state: None,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(rows)
}

pub fn create_todo_reminder(
    conn: &Connection,
    todo_template_id: i64,
    def: ReminderDefinition,
    now: &str,
) -> AppResult<ReminderDefinition> {
    validate_definition(&def)?;
    conn.execute(
        "INSERT INTO todo_template_reminder
            (todo_template_id, mode, fire_at_literal, anchor, basis, trigger_status_id,
             offset_value, offset_unit, offset_direction, fire_time, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            todo_template_id,
            mode_str(def.mode),
            def.fire_at_literal,
            def.anchor.map(|a| a.as_str()),
            def.basis.map(|b| b.as_str()),
            def.trigger_status_id,
            def.offset_value,
            def.offset_unit.map(|u| u.as_str()),
            def.offset_direction.map(|d| d.as_str()),
            def.fire_time,
            now,
        ],
    )?;
    let id = conn.last_insert_rowid();
    Ok(list_todo_reminders(conn, todo_template_id)?
        .into_iter()
        .find(|r| r.id == Some(id))
        .expect("just inserted"))
}

pub fn update_todo_reminder(
    conn: &Connection,
    id: i64,
    def: ReminderDefinition,
) -> AppResult<ReminderDefinition> {
    validate_definition(&def)?;
    let todo_template_id: Option<i64> = conn
        .query_row(
            "SELECT todo_template_id FROM todo_template_reminder WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .optional()?;
    let todo_template_id = todo_template_id.ok_or_else(|| reminder_not_found(id))?;
    conn.execute(
        "UPDATE todo_template_reminder SET
            mode = ?1, fire_at_literal = ?2, anchor = ?3, basis = ?4,
            trigger_status_id = ?5, offset_value = ?6, offset_unit = ?7,
            offset_direction = ?8, fire_time = ?9
         WHERE id = ?10",
        params![
            mode_str(def.mode),
            def.fire_at_literal,
            def.anchor.map(|a| a.as_str()),
            def.basis.map(|b| b.as_str()),
            def.trigger_status_id,
            def.offset_value,
            def.offset_unit.map(|u| u.as_str()),
            def.offset_direction.map(|d| d.as_str()),
            def.fire_time,
            id,
        ],
    )?;
    Ok(list_todo_reminders(conn, todo_template_id)?
        .into_iter()
        .find(|r| r.id == Some(id))
        .expect("just updated"))
}

pub fn delete_todo_reminder(conn: &Connection, id: i64) -> AppResult<()> {
    let affected = conn.execute(
        "DELETE FROM todo_template_reminder WHERE id = ?1",
        params![id],
    )?;
    if affected == 0 {
        return Err(reminder_not_found(id));
    }
    Ok(())
}

// --- helpers ---------------------------------------------------------------

fn validate_definition(def: &ReminderDefinition) -> AppResult<()> {
    match def.mode {
        ReminderMode::Absolute => {
            if def.fire_at_literal.as_deref().unwrap_or("").is_empty() {
                return Err(AppError::new(
                    "reminder_absolute_missing_date",
                    "Een vaste-datum-herinnering heeft een datum en tijd nodig.",
                ));
            }
        }
        ReminderMode::Relative => {
            if def.anchor.is_none()
                || def.basis.is_none()
                || def.offset_value.is_none()
                || def.offset_unit.is_none()
                || def.offset_direction.is_none()
            {
                return Err(AppError::new(
                    "reminder_relative_incomplete",
                    "Een relatieve herinnering heeft anker, basis, offset, eenheid en richting nodig.",
                ));
            }
            // "vóór" only with a deadline basis; a status before the fact is
            // not predictable (spec §6.2).
            if matches!(def.basis, Some(crate::models::ReminderBasis::Status))
                && matches!(
                    def.offset_direction,
                    Some(crate::models::ReminderDirection::Before)
                )
            {
                return Err(AppError::new(
                    "reminder_status_before",
                    "Bij een status-gebaseerde herinnering staat de richting vast op \"ná\".",
                ));
            }
        }
    }
    Ok(())
}

fn mode_str(m: ReminderMode) -> &'static str {
    match m {
        ReminderMode::Absolute => "absolute",
        ReminderMode::Relative => "relative",
    }
}

fn renumber_todos(conn: &Connection, template_id: i64) -> AppResult<()> {
    let ids: Vec<i64> = {
        let mut stmt =
            conn.prepare("SELECT id FROM todo_template WHERE template_id = ?1 ORDER BY position")?;
        let ids = stmt
            .query_map(params![template_id], |r| r.get(0))?
            .collect::<Result<Vec<i64>, _>>()?;
        ids
    };
    let tx = conn.unchecked_transaction()?;
    for (i, id) in ids.iter().enumerate() {
        tx.execute(
            "UPDATE todo_template SET position = ?1 WHERE id = ?2",
            params![i as i64 + 1, id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

fn not_found(id: i64) -> AppError {
    AppError::new(
        "template_not_found",
        format!("Het sjabloon met id {id} bestaat niet (meer)."),
    )
}
fn todo_not_found(id: i64) -> AppError {
    AppError::new(
        "template_todo_not_found",
        format!("De sjabloontaak met id {id} bestaat niet (meer)."),
    )
}
fn reminder_not_found(id: i64) -> AppError {
    AppError::new(
        "template_reminder_not_found",
        format!("De sjabloonherinnering met id {id} bestaat niet (meer)."),
    )
}
fn template_link_not_found(id: i64) -> AppError {
    AppError::new(
        "template_link_not_found",
        format!("De sjabloonlink met id {id} bestaat niet (meer)."),
    )
}
