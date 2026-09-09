//! Taak (`todo`) CRUD, ordering, verplaatsen, dupliceren, status/deadline
//! mutaties, links en kenmerkwaarden (spec §1, §1.1–§1.4).
//!
//! Invarianten die hier afgedwongen worden, nooit in de UI:
//!   * `position` binnen een project is een aaneengesloten 1..n reeks — na elke
//!     insert/delete/move/reorder wordt hij opnieuw dichtgetrokken;
//!   * een losse taak heeft `position IS NULL`;
//!   * elke statuswissel (ook via snapshot en "als afgerond markeren") schrijft
//!     een `todo_status_event` via `statuses::append_status_event`;
//!   * bij het verplaatsen tussen sjablonen worden projectkenmerkwaarden van een
//!     ánder sjabloon leeggemaakt (spec §1.2).
//!
//! Elke mutatie die een opgeloste `fire_at` kan raken roept de bijbehorende
//! `recalc::*`-hook aan.

use rusqlite::{params, Connection, OptionalExtension};

use crate::error::{AppError, AppResult};
use crate::models::{
    CreateTodoInput, Link, MoveTodoResult, ReminderDefinition, ReminderMode, Todo,
    TodoAttributeValue, UpdateTodoInput,
};
use crate::{projects, recalc, statuses};

// --- lezen ---------------------------------------------------------------

/// Alle taken, optioneel gefilterd. `project_id` = `Some(id)` beperkt tot dat
/// project, `loose_only` tot taken zonder project. Taken uit gearchiveerde
/// projecten vallen weg tenzij `include_archived`.
pub fn list_todos(
    conn: &Connection,
    project_id: Option<i64>,
    loose_only: bool,
    include_archived: bool,
) -> AppResult<Vec<Todo>> {
    let mut sql = String::from(
        "SELECT t.id FROM todo t
         LEFT JOIN project p ON p.id = t.project_id
         WHERE 1 = 1",
    );
    if let Some(pid) = project_id {
        sql.push_str(&format!(" AND t.project_id = {pid}"));
    }
    if loose_only {
        sql.push_str(" AND t.project_id IS NULL");
    }
    if !include_archived {
        sql.push_str(" AND (p.id IS NULL OR p.state <> 'archived')");
    }
    sql.push_str(" ORDER BY t.project_id IS NULL, t.project_id, t.position, t.id");

    let ids: Vec<i64> = {
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt
            .query_map([], |r| r.get(0))?
            .collect::<Result<_, _>>()?;
        rows
    };
    ids.into_iter().map(|id| read_todo(conn, id)).collect()
}

/// One taak with its links, kenmerkwaarden and herinneringdefinities.
pub fn get_todo(conn: &Connection, id: i64) -> AppResult<Todo> {
    read_todo(conn, id)
}

pub(crate) fn read_todo(conn: &Connection, id: i64) -> AppResult<Todo> {
    let mut todo = conn
        .query_row(
            "SELECT id, project_id, position, title, description, status_id,
                    deadline_date, deadline_time, created_at
             FROM todo WHERE id = ?1",
            params![id],
            |r| {
                Ok(Todo {
                    id: r.get(0)?,
                    project_id: r.get(1)?,
                    position: r.get(2)?,
                    title: r.get(3)?,
                    description: r.get(4)?,
                    status_id: r.get(5)?,
                    deadline_date: r.get(6)?,
                    deadline_time: r.get(7)?,
                    created_at: r.get(8)?,
                    links: Vec::new(),
                    attribute_values: Vec::new(),
                    reminders: Vec::new(),
                })
            },
        )
        .optional()?
        .ok_or_else(|| not_found(id))?;

    todo.links = list_links(conn, id)?;
    todo.attribute_values = list_attribute_values(conn, id)?;
    todo.reminders = list_reminders(conn, id)?;
    Ok(todo)
}

fn list_links(conn: &Connection, todo_id: i64) -> AppResult<Vec<Link>> {
    let mut stmt =
        conn.prepare("SELECT id, todo_id, url, title FROM link WHERE todo_id = ?1 ORDER BY id")?;
    let rows = stmt
        .query_map(params![todo_id], |r| {
            Ok(Link {
                id: r.get(0)?,
                todo_id: r.get(1)?,
                url: r.get(2)?,
                title: r.get(3)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(rows)
}

fn list_attribute_values(conn: &Connection, todo_id: i64) -> AppResult<Vec<TodoAttributeValue>> {
    let mut stmt = conn.prepare(
        "SELECT v.attribute_id, v.value_text, v.value_number, v.value_date, v.value_time,
                v.value_bool, v.option_id, COALESCE(o.label, v.option_label_snapshot)
         FROM todo_attribute_value v
         LEFT JOIN attribute_option o ON o.id = v.option_id
         WHERE v.todo_id = ?1
         ORDER BY v.attribute_id, v.id",
    )?;
    #[allow(clippy::type_complexity)]
    let raw: Vec<(
        i64,
        Option<String>,
        Option<f64>,
        Option<String>,
        Option<String>,
        Option<i64>,
        Option<i64>,
        Option<String>,
    )> = stmt
        .query_map(params![todo_id], |r| {
            Ok((
                r.get(0)?,
                r.get(1)?,
                r.get(2)?,
                r.get(3)?,
                r.get(4)?,
                r.get(5)?,
                r.get(6)?,
                r.get(7)?,
            ))
        })?
        .collect::<Result<_, _>>()?;

    let mut out: Vec<TodoAttributeValue> = Vec::new();
    for (attribute_id, text, number, date, time, bool_, option_id, label) in raw {
        match out.iter_mut().find(|v| v.attribute_id == attribute_id) {
            Some(existing) => {
                if let Some(oid) = option_id {
                    existing.option_ids.push(oid);
                    if let Some(l) = label {
                        existing.option_labels.push(l);
                    }
                }
            }
            None => out.push(TodoAttributeValue {
                attribute_id,
                value_text: text,
                value_number: number,
                value_date: date,
                value_time: time,
                value_bool: bool_.map(|b| b != 0),
                option_ids: option_id.into_iter().collect(),
                option_labels: label.into_iter().collect(),
            }),
        }
    }
    Ok(out)
}

fn list_reminders(conn: &Connection, todo_id: i64) -> AppResult<Vec<ReminderDefinition>> {
    let mut stmt = conn.prepare(
        "SELECT id, mode, fire_at_literal, anchor, basis, trigger_status_id,
                offset_value, offset_unit, offset_direction, fire_time,
                fire_at, fired_at, fired_late, seen_at
         FROM reminder WHERE todo_id = ?1 ORDER BY id",
    )?;
    let mut rows: Vec<ReminderDefinition> = stmt
        .query_map(params![todo_id], |r| {
            let mode_str: String = r.get(1)?;
            Ok(ReminderDefinition {
                id: Some(r.get(0)?),
                mode: if mode_str == "absolute" {
                    ReminderMode::Absolute
                } else {
                    ReminderMode::Relative
                },
                fire_at_literal: r.get(2)?,
                anchor: str_enum(r.get::<_, Option<String>>(3)?),
                basis: str_enum(r.get::<_, Option<String>>(4)?),
                trigger_status_id: r.get(5)?,
                offset_value: r.get(6)?,
                offset_unit: str_enum(r.get::<_, Option<String>>(7)?),
                offset_direction: str_enum(r.get::<_, Option<String>>(8)?),
                fire_time: r.get(9)?,
                fire_at: r.get(10)?,
                fired_at: r.get(11)?,
                fired_late: r.get::<_, i64>(12)? != 0,
                seen_at: r.get(13)?,
                state: None,
            })
        })?
        .collect::<Result<_, _>>()?;

    // Toon de *live* afgeleide toestand + het vers opgeloste vuurmoment
    // (spec §6.3), los van of een recalc-hook al liep.
    for def in &mut rows {
        if let Some(id) = def.id {
            let (fire_at, state) = crate::reminders::resolved_view(conn, id)?;
            def.fire_at = fire_at;
            def.state = Some(state);
        }
    }
    Ok(rows)
}

fn str_enum<T: serde::de::DeserializeOwned>(s: Option<String>) -> Option<T> {
    s.and_then(|s| serde_json::from_value(serde_json::Value::String(s)).ok())
}

// --- aanmaken ----------------------------------------------------------

pub fn create_todo(conn: &Connection, input: CreateTodoInput, now: &str) -> AppResult<Todo> {
    if input.title.trim().is_empty() {
        return Err(AppError::new("todo_title_empty", "Geef de taak een titel."));
    }
    let status_id = match input.status_id {
        Some(id) => id,
        None => default_status_id(conn)?,
    };

    let tx = conn.unchecked_transaction()?;
    let position = match input.project_id {
        None => None,
        Some(pid) => {
            ensure_project(&tx, pid)?;
            let max: i64 = tx.query_row(
                "SELECT COALESCE(MAX(position), 0) FROM todo WHERE project_id = ?1",
                params![pid],
                |r| r.get(0),
            )?;
            match input.position {
                Some(want) if want >= 1 && want <= max => {
                    tx.execute(
                        "UPDATE todo SET position = position + 1
                         WHERE project_id = ?1 AND position >= ?2",
                        params![pid, want],
                    )?;
                    Some(want)
                }
                _ => Some(max + 1),
            }
        }
    };

    tx.execute(
        "INSERT INTO todo (project_id, position, title, description, status_id,
                           deadline_date, deadline_time, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            input.project_id,
            position,
            input.title.trim(),
            input.description.trim(),
            status_id,
            input.deadline_date,
            input.deadline_time,
            now,
        ],
    )?;
    let id = tx.last_insert_rowid();
    statuses::append_status_event(&tx, id, status_id, now)?;
    tx.commit()?;

    if let Some(pid) = input.project_id {
        projects::derive_project_state(conn, pid, now)?;
        let pos = position.unwrap_or(0);
        recalc::recalc_neighbor_reminders(conn, pid, &[pos])?;
    }
    recalc::recalc_reminders_for_todo(conn, id)?;
    read_todo(conn, id)
}

// --- bewerken --------------------------------------------------------

pub fn update_todo(conn: &Connection, id: i64, input: UpdateTodoInput) -> AppResult<Todo> {
    ensure_todo(conn, id)?;
    if let Some(title) = &input.title {
        if title.trim().is_empty() {
            return Err(AppError::new("todo_title_empty", "Geef de taak een titel."));
        }
        conn.execute(
            "UPDATE todo SET title = ?1 WHERE id = ?2",
            params![title.trim(), id],
        )?;
    }
    if let Some(description) = &input.description {
        conn.execute(
            "UPDATE todo SET description = ?1 WHERE id = ?2",
            params![description.trim(), id],
        )?;
    }
    read_todo(conn, id)
}

/// Statuswissel: schrijft een event, herleidt de projecttoestand en trapt de
/// recalc-hooks aan (spec §1, §5.1).
pub fn set_todo_status(conn: &Connection, id: i64, status_id: i64, now: &str) -> AppResult<Todo> {
    ensure_todo(conn, id)?;
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM status WHERE id = ?1",
            params![status_id],
            |_| Ok(true),
        )
        .optional()?
        .unwrap_or(false);
    if !exists {
        return Err(AppError::new(
            "status_not_found",
            format!("De status met id {status_id} bestaat niet (meer)."),
        ));
    }

    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "UPDATE todo SET status_id = ?1 WHERE id = ?2",
        params![status_id, id],
    )?;
    statuses::append_status_event(&tx, id, status_id, now)?;
    tx.commit()?;

    if let Some(pid) = project_of(conn, id)? {
        projects::derive_project_state(conn, pid, now)?;
        // Status-gebaseerde herinneringen op de buren ankeren op déze taak.
        recalc::recalc_neighbor_reminders(conn, pid, &[])?;
    }
    recalc::recalc_reminders_for_todo(conn, id)?;
    read_todo(conn, id)
}

/// Deadline zetten of wissen (spec §1 — datum + optioneel tijdstip, lokale tijd).
pub fn set_todo_deadline(
    conn: &Connection,
    id: i64,
    date: Option<&str>,
    time: Option<&str>,
    _now: &str,
) -> AppResult<Todo> {
    ensure_todo(conn, id)?;
    // Zonder datum is er geen deadlinemoment; een tijdstip alleen heeft geen zin.
    let (date, time) = match date {
        Some(d) if !d.trim().is_empty() => (
            Some(d.trim()),
            time.map(str::trim).filter(|t| !t.is_empty()),
        ),
        _ => (None, None),
    };
    conn.execute(
        "UPDATE todo SET deadline_date = ?1, deadline_time = ?2 WHERE id = ?3",
        params![date, time, id],
    )?;
    recalc::recalc_deadline_based(conn, id)?;
    recalc::recalc_reminders_for_todo(conn, id)?;
    read_todo(conn, id)
}

// --- volgorde -------------------------------------------------------

/// Persisteer een nieuwe volgorde binnen één project; posities worden 1..n.
pub fn reorder_todos(
    conn: &Connection,
    project_id: i64,
    ids_in_order: &[i64],
    _now: &str,
) -> AppResult<Vec<Todo>> {
    let current: Vec<i64> = {
        let mut stmt = conn.prepare("SELECT id FROM todo WHERE project_id = ?1")?;
        let rows = stmt
            .query_map(params![project_id], |r| r.get(0))?
            .collect::<Result<_, _>>()?;
        rows
    };
    if ids_in_order.len() != current.len() || !current.iter().all(|id| ids_in_order.contains(id)) {
        return Err(AppError::new(
            "todo_reorder_mismatch",
            "De doorgegeven volgorde komt niet overeen met de taken van dit project.",
        ));
    }
    let tx = conn.unchecked_transaction()?;
    for id in ids_in_order {
        tx.execute(
            "UPDATE todo SET position = position + 100000 WHERE id = ?1",
            params![id],
        )?;
    }
    for (i, id) in ids_in_order.iter().enumerate() {
        tx.execute(
            "UPDATE todo SET position = ?1 WHERE id = ?2",
            params![i as i64 + 1, id],
        )?;
    }
    tx.commit()?;

    let changed: Vec<i64> = (1..=ids_in_order.len() as i64).collect();
    recalc::recalc_neighbor_reminders(conn, project_id, &changed)?;
    list_todos(conn, Some(project_id), false, true)
}

// --- verplaatsen (spec §1.2) --------------------------------------

pub fn move_todo(
    conn: &Connection,
    todo_id: i64,
    target_project_id: Option<i64>,
    now: &str,
) -> AppResult<MoveTodoResult> {
    let (old_project, old_position) = conn
        .query_row(
            "SELECT project_id, position FROM todo WHERE id = ?1",
            params![todo_id],
            |r| Ok((r.get::<_, Option<i64>>(0)?, r.get::<_, Option<i64>>(1)?)),
        )
        .optional()?
        .ok_or_else(|| not_found(todo_id))?;

    if old_project == target_project_id {
        return read_todo(conn, todo_id).map(|todo| MoveTodoResult {
            todo,
            cleared_attribute_ids: Vec::new(),
        });
    }

    let target_template: Option<i64> = match target_project_id {
        None => None,
        Some(pid) => {
            ensure_project(conn, pid)?;
            conn.query_row(
                "SELECT template_id FROM project WHERE id = ?1",
                params![pid],
                |r| r.get(0),
            )?
        }
    };

    // Projectkenmerkwaarden waarvan het kenmerk bij een ander sjabloon hoort
    // dan dat van het doelproject → leegmaken (spec §1.2).
    let cleared: Vec<i64> = {
        let mut stmt = conn.prepare(
            "SELECT DISTINCT v.attribute_id
             FROM todo_attribute_value v
             JOIN attribute_definition a ON a.id = v.attribute_id
             WHERE v.todo_id = ?1 AND a.scope = 'project'
               AND (?2 IS NULL OR a.template_id <> ?2)",
        )?;
        let rows = stmt
            .query_map(params![todo_id, target_template], |r| r.get(0))?
            .collect::<Result<_, _>>()?;
        rows
    };

    let tx = conn.unchecked_transaction()?;
    for attr_id in &cleared {
        tx.execute(
            "DELETE FROM todo_attribute_value WHERE todo_id = ?1 AND attribute_id = ?2",
            params![todo_id, attr_id],
        )?;
    }

    let new_position = match target_project_id {
        None => None,
        Some(pid) => {
            let max: i64 = tx.query_row(
                "SELECT COALESCE(MAX(position), 0) FROM todo WHERE project_id = ?1",
                params![pid],
                |r| r.get(0),
            )?;
            Some(max + 1)
        }
    };
    tx.execute(
        "UPDATE todo SET project_id = ?1, position = ?2 WHERE id = ?3",
        params![target_project_id, new_position, todo_id],
    )?;
    if let Some(old_pid) = old_project {
        reflow_positions(&tx, old_pid)?;
    }
    tx.commit()?;

    if let Some(old_pid) = old_project {
        projects::derive_project_state(conn, old_pid, now)?;
        recalc::recalc_neighbor_reminders(conn, old_pid, &[old_position.unwrap_or(0)])?;
    }
    if let Some(new_pid) = target_project_id {
        projects::derive_project_state(conn, new_pid, now)?;
        recalc::recalc_neighbor_reminders(conn, new_pid, &[new_position.unwrap_or(0)])?;
    }
    recalc::recalc_reminders_for_todo(conn, todo_id)?;

    Ok(MoveTodoResult {
        todo: read_todo(conn, todo_id)?,
        cleared_attribute_ids: cleared,
    })
}

// --- dupliceren (spec §1.3) --------------------------------------

pub fn duplicate_todo(conn: &Connection, id: i64, now: &str) -> AppResult<Todo> {
    let src = conn
        .query_row(
            "SELECT project_id, position, title, description FROM todo WHERE id = ?1",
            params![id],
            |r| {
                Ok((
                    r.get::<_, Option<i64>>(0)?,
                    r.get::<_, Option<i64>>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                ))
            },
        )
        .optional()?
        .ok_or_else(|| not_found(id))?;
    let (project_id, _pos, title, description) = src;
    // "(kopie)" achteraan zodat de dubbel meteen opvalt (spec §1.3, net als projecten).
    let title = format!("{title} (kopie)");
    let status_id = default_status_id(conn)?;

    let tx = conn.unchecked_transaction()?;
    let position = match project_id {
        None => None,
        Some(pid) => {
            let max: i64 = tx.query_row(
                "SELECT COALESCE(MAX(position), 0) FROM todo WHERE project_id = ?1",
                params![pid],
                |r| r.get(0),
            )?;
            Some(max + 1)
        }
    };
    tx.execute(
        "INSERT INTO todo (project_id, position, title, description, status_id, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![project_id, position, title, description, status_id, now],
    )?;
    let new_id = tx.last_insert_rowid();
    statuses::append_status_event(&tx, new_id, status_id, now)?;
    copy_links(&tx, id, new_id)?;
    copy_attribute_values(&tx, id, new_id)?;
    copy_reminder_defs(&tx, id, new_id, now)?;
    tx.commit()?;

    if let Some(pid) = project_id {
        projects::derive_project_state(conn, pid, now)?;
        recalc::recalc_neighbor_reminders(conn, pid, &[position.unwrap_or(0)])?;
    }
    recalc::recalc_reminders_for_todo(conn, new_id)?;
    read_todo(conn, new_id)
}

// --- verwijderen (spec §1.4) ------------------------------------

pub fn delete_todo(conn: &Connection, id: i64, now: &str) -> AppResult<()> {
    let project_id = conn
        .query_row(
            "SELECT project_id FROM todo WHERE id = ?1",
            params![id],
            |r| r.get::<_, Option<i64>>(0),
        )
        .optional()?
        .ok_or_else(|| not_found(id))?;

    let tx = conn.unchecked_transaction()?;
    // reminders / links / status-events / kenmerkwaarden cascaden mee (FK).
    tx.execute("DELETE FROM todo WHERE id = ?1", params![id])?;
    if let Some(pid) = project_id {
        reflow_positions(&tx, pid)?;
    }
    tx.commit()?;

    if let Some(pid) = project_id {
        projects::derive_project_state(conn, pid, now)?;
        recalc::recalc_neighbor_reminders(conn, pid, &[])?;
    }
    Ok(())
}

// --- links ---------------------------------------------------------

pub fn add_link(
    conn: &Connection,
    todo_id: i64,
    url: &str,
    title: Option<&str>,
) -> AppResult<Todo> {
    ensure_todo(conn, todo_id)?;
    if url.trim().is_empty() {
        return Err(AppError::new(
            "link_url_empty",
            "Geef een URL of een bestandspad op.",
        ));
    }
    conn.execute(
        "INSERT INTO link (todo_id, url, title) VALUES (?1, ?2, ?3)",
        params![
            todo_id,
            url.trim(),
            title.map(str::trim).filter(|s| !s.is_empty())
        ],
    )?;
    read_todo(conn, todo_id)
}

pub fn update_link(
    conn: &Connection,
    link_id: i64,
    url: &str,
    title: Option<&str>,
) -> AppResult<Todo> {
    if url.trim().is_empty() {
        return Err(AppError::new(
            "link_url_empty",
            "Geef een URL of een bestandspad op.",
        ));
    }
    let todo_id: Option<i64> = conn
        .query_row(
            "SELECT todo_id FROM link WHERE id = ?1",
            params![link_id],
            |r| r.get(0),
        )
        .optional()?;
    let todo_id = todo_id.ok_or_else(|| {
        AppError::new(
            "link_not_found",
            format!("De link met id {link_id} bestaat niet (meer)."),
        )
    })?;
    conn.execute(
        "UPDATE link SET url = ?1, title = ?2 WHERE id = ?3",
        params![
            url.trim(),
            title.map(str::trim).filter(|s| !s.is_empty()),
            link_id
        ],
    )?;
    read_todo(conn, todo_id)
}

pub fn remove_link(conn: &Connection, link_id: i64) -> AppResult<Option<Todo>> {
    let todo_id: Option<i64> = conn
        .query_row(
            "SELECT todo_id FROM link WHERE id = ?1",
            params![link_id],
            |r| r.get(0),
        )
        .optional()?;
    let Some(todo_id) = todo_id else {
        return Ok(None);
    };
    conn.execute("DELETE FROM link WHERE id = ?1", params![link_id])?;
    Ok(Some(read_todo(conn, todo_id)?))
}

// --- herinneringen per taak (definitie-CRUD via de popover, spec §3/§4) --

fn validate_reminder(def: &ReminderDefinition) -> AppResult<()> {
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

pub fn create_reminder(
    conn: &Connection,
    todo_id: i64,
    def: ReminderDefinition,
    now: &str,
) -> AppResult<Todo> {
    ensure_todo(conn, todo_id)?;
    validate_reminder(&def)?;
    conn.execute(
        "INSERT INTO reminder
            (todo_id, mode, fire_at_literal, anchor, basis, trigger_status_id,
             offset_value, offset_unit, offset_direction, fire_time, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            todo_id,
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
    recalc::recalc_reminders_for_todo(conn, todo_id)?;
    read_todo(conn, todo_id)
}

pub fn update_reminder(
    conn: &Connection,
    reminder_id: i64,
    def: ReminderDefinition,
) -> AppResult<Todo> {
    validate_reminder(&def)?;
    let todo_id: Option<i64> = conn
        .query_row(
            "SELECT todo_id FROM reminder WHERE id = ?1",
            params![reminder_id],
            |r| r.get(0),
        )
        .optional()?;
    let todo_id = todo_id.ok_or_else(|| {
        AppError::new(
            "reminder_not_found",
            format!("De herinnering met id {reminder_id} bestaat niet (meer)."),
        )
    })?;
    conn.execute(
        "UPDATE reminder SET
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
            reminder_id,
        ],
    )?;
    recalc::recalc_reminders_for_todo(conn, todo_id)?;
    read_todo(conn, todo_id)
}

pub fn delete_reminder(conn: &Connection, reminder_id: i64) -> AppResult<Option<Todo>> {
    let todo_id: Option<i64> = conn
        .query_row(
            "SELECT todo_id FROM reminder WHERE id = ?1",
            params![reminder_id],
            |r| r.get(0),
        )
        .optional()?;
    let Some(todo_id) = todo_id else {
        return Ok(None);
    };
    conn.execute("DELETE FROM reminder WHERE id = ?1", params![reminder_id])?;
    Ok(Some(read_todo(conn, todo_id)?))
}

// --- kenmerkwaarden per taak -------------------------------------

/// Vervang de kenmerkwaarde voor één kenmerk op één taak. Een scalaire waarde
/// waarin elk veld leeg is (en geen opties) wist de invulling.
pub fn set_todo_attribute_value(
    conn: &Connection,
    todo_id: i64,
    value: TodoAttributeValue,
    _now: &str,
) -> AppResult<Todo> {
    ensure_todo(conn, todo_id)?;
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "DELETE FROM todo_attribute_value WHERE todo_id = ?1 AND attribute_id = ?2",
        params![todo_id, value.attribute_id],
    )?;

    if !value.option_ids.is_empty() {
        for oid in &value.option_ids {
            tx.execute(
                "INSERT INTO todo_attribute_value (todo_id, attribute_id, option_id)
                 VALUES (?1, ?2, ?3)",
                params![todo_id, value.attribute_id, oid],
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
        // Een tijdstip zonder datum is betekenisloos — bewaar het enkel samen met een datum.
        let time = value
            .value_date
            .as_deref()
            .and(value.value_time.as_deref())
            .map(str::trim)
            .filter(|s| !s.is_empty());
        if has_scalar {
            tx.execute(
                "INSERT INTO todo_attribute_value
                    (todo_id, attribute_id, value_text, value_number, value_date, value_time, value_bool)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    todo_id,
                    value.attribute_id,
                    value
                        .value_text
                        .as_deref()
                        .map(str::trim)
                        .filter(|s| !s.is_empty()),
                    value.value_number,
                    value.value_date,
                    time,
                    value.value_bool.map(|b| b as i64),
                ],
            )?;
        }
    }
    tx.commit()?;
    read_todo(conn, todo_id)
}

// --- gedeelde helpers -------------------------------------------

pub(crate) fn default_status_id(conn: &Connection) -> AppResult<i64> {
    conn.query_row(
        "SELECT id FROM status WHERE is_default = 1 LIMIT 1",
        [],
        |r| r.get(0),
    )
    .map_err(|_| AppError::new("no_default_status", "Er is geen standaardstatus ingesteld."))
}

pub(crate) fn done_status_id(conn: &Connection) -> AppResult<i64> {
    conn.query_row("SELECT id FROM status WHERE is_done = 1 LIMIT 1", [], |r| {
        r.get(0)
    })
    .map_err(|_| AppError::new("no_done_status", "Er is geen afgerond-status ingesteld."))
}

/// Trek `position` binnen een project weer aaneengesloten dicht tot 1..n.
pub(crate) fn reflow_positions(conn: &Connection, project_id: i64) -> AppResult<()> {
    let ids: Vec<i64> = {
        let mut stmt = conn.prepare(
            "SELECT id FROM todo WHERE project_id = ?1 ORDER BY position IS NULL, position, id",
        )?;
        let rows = stmt
            .query_map(params![project_id], |r| r.get(0))?
            .collect::<Result<_, _>>()?;
        rows
    };
    for id in &ids {
        conn.execute(
            "UPDATE todo SET position = position + 100000 WHERE id = ?1",
            params![id],
        )?;
    }
    for (i, id) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE todo SET position = ?1 WHERE id = ?2",
            params![i as i64 + 1, id],
        )?;
    }
    Ok(())
}

pub(crate) fn copy_links(conn: &Connection, from: i64, to: i64) -> AppResult<()> {
    conn.execute(
        "INSERT INTO link (todo_id, url, title)
         SELECT ?1, url, title FROM link WHERE todo_id = ?2",
        params![to, from],
    )?;
    Ok(())
}

pub(crate) fn copy_attribute_values(conn: &Connection, from: i64, to: i64) -> AppResult<()> {
    conn.execute(
        "INSERT INTO todo_attribute_value
            (todo_id, attribute_id, value_text, value_number, value_date, value_time, value_bool,
             option_id, option_label_snapshot)
         SELECT ?1, attribute_id, value_text, value_number, value_date, value_time, value_bool,
                option_id, option_label_snapshot
         FROM todo_attribute_value WHERE todo_id = ?2",
        params![to, from],
    )?;
    Ok(())
}

/// Kopieer de herinnering*definities* van `from` naar `to`; runtime-kolommen
/// (`fire_at`, `fired_at`, `seen_at`) blijven leeg — de herinneringen-engine lost ze op.
pub(crate) fn copy_reminder_defs(
    conn: &Connection,
    from: i64,
    to: i64,
    now: &str,
) -> AppResult<()> {
    conn.execute(
        "INSERT INTO reminder
            (todo_id, mode, fire_at_literal, anchor, basis, trigger_status_id,
             offset_value, offset_unit, offset_direction, fire_time, created_at)
         SELECT ?1, mode, fire_at_literal, anchor, basis, trigger_status_id,
                offset_value, offset_unit, offset_direction, fire_time, ?2
         FROM reminder WHERE todo_id = ?3",
        params![to, now, from],
    )?;
    Ok(())
}

fn project_of(conn: &Connection, todo_id: i64) -> AppResult<Option<i64>> {
    Ok(conn.query_row(
        "SELECT project_id FROM todo WHERE id = ?1",
        params![todo_id],
        |r| r.get(0),
    )?)
}

fn ensure_todo(conn: &Connection, id: i64) -> AppResult<()> {
    let exists: bool = conn
        .query_row("SELECT 1 FROM todo WHERE id = ?1", params![id], |_| {
            Ok(true)
        })
        .optional()?
        .unwrap_or(false);
    if exists {
        Ok(())
    } else {
        Err(not_found(id))
    }
}

fn ensure_project(conn: &Connection, id: i64) -> AppResult<()> {
    let exists: bool = conn
        .query_row("SELECT 1 FROM project WHERE id = ?1", params![id], |_| {
            Ok(true)
        })
        .optional()?
        .unwrap_or(false);
    if exists {
        Ok(())
    } else {
        Err(AppError::new(
            "project_not_found",
            format!("Het project met id {id} bestaat niet (meer)."),
        ))
    }
}

fn not_found(id: i64) -> AppError {
    AppError::new(
        "todo_not_found",
        format!("De taak met id {id} bestaat niet (meer)."),
    )
}
