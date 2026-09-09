//! Project (`project`) CRUD, de drie projecttoestanden en alle `···`-acties
//! (spec §2, §2.1, §2.2), plus de snapshot-instantiatie uit een sjabloon.
//!
//! Toestandsregels, afgedwongen hier:
//!   * `active` — er is minstens één taak die niet op de afgerond-status staat;
//!   * `completed` — er zijn taken en ze staan állemaal op de afgerond-status,
//!     `completed_at` gezet. `active ↔ completed` is volledig automatisch en
//!     omkeerbaar (`derive_project_state`);
//!   * `archived` — handmatig via `···`; `archived_at` gezet; blijft
//!     doorzoekbaar maar valt uit de views. Terugzetten herleidt
//!     `active`/`completed`.
//!
//! Latere sjabloonwijzigingen raken bestaande projecten niet — `instantiate_*`
//! leest een snapshot.

use rusqlite::{params, Connection, OptionalExtension};

use crate::error::{AppError, AppResult};
use crate::models::{CreateProjectInput, Project, ProjectState};
use crate::{recalc, statuses, todos};

// --- lezen ---------------------------------------------------------------

/// Projecten, optioneel gefilterd op toestand (meervoudige selectie). Een lege
/// `states` betekent "alles".
pub fn list_projects(conn: &Connection, states: &[ProjectState]) -> AppResult<Vec<Project>> {
    let mut sql = String::from(
        "SELECT p.id, p.name, p.color, p.template_id,
                (SELECT pt.name FROM project_template pt WHERE pt.id = p.template_id),
                p.state, p.created_at, p.completed_at, p.archived_at,
                (SELECT COUNT(*) FROM todo t WHERE t.project_id = p.id),
                (SELECT COUNT(*) FROM todo t JOIN status s ON s.id = t.status_id
                 WHERE t.project_id = p.id AND s.is_done = 1)
         FROM project p",
    );
    if !states.is_empty() {
        let list = states
            .iter()
            .map(|s| format!("'{}'", s.as_str()))
            .collect::<Vec<_>>()
            .join(", ");
        sql.push_str(&format!(" WHERE p.state IN ({list})"));
    }
    sql.push_str(" ORDER BY p.name");

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map([], |r| {
            let state_str: String = r.get(5)?;
            Ok(Project {
                id: r.get(0)?,
                name: r.get(1)?,
                color: r.get(2)?,
                template_id: r.get(3)?,
                template_name: r.get(4)?,
                state: ProjectState::parse(&state_str).unwrap_or(ProjectState::Active),
                created_at: r.get(6)?,
                completed_at: r.get(7)?,
                archived_at: r.get(8)?,
                todo_count: r.get(9)?,
                done_count: r.get(10)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(rows)
}

pub fn get_project(conn: &Connection, id: i64) -> AppResult<Project> {
    list_projects(conn, &[])?
        .into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| not_found(id))
}

// --- aanmaken ----------------------------------------------------------

/// Maak een project — met sjabloon (snapshot) óf leeg. Geen startdatum (spec §2).
pub fn create_project(
    conn: &Connection,
    input: CreateProjectInput,
    now: &str,
) -> AppResult<Project> {
    if input.name.trim().is_empty() {
        return Err(AppError::new(
            "project_name_empty",
            "Geef het project een naam.",
        ));
    }
    match input.template_id {
        Some(template_id) => {
            instantiate_from_template(conn, template_id, input.name.trim(), &input.color, now)
        }
        None => {
            conn.execute(
                "INSERT INTO project (name, color, template_id, state, created_at)
                 VALUES (?1, ?2, NULL, 'active', ?3)",
                params![input.name.trim(), input.color, now],
            )?;
            get_project(conn, conn.last_insert_rowid())
        }
    }
}

/// De snapshot-kopie (spec §2, §5): `todo_template`-rijen → `todo`-rijen met
/// kenmerkwaarden en herinneringdefinities; géén deadlines; elke taak op de
/// standaardstatus met een `todo_status_event` voor die startstatus.
pub fn instantiate_from_template(
    conn: &Connection,
    template_id: i64,
    name: &str,
    color: &str,
    now: &str,
) -> AppResult<Project> {
    let template_exists: bool = conn
        .query_row(
            "SELECT 1 FROM project_template WHERE id = ?1",
            params![template_id],
            |_| Ok(true),
        )
        .optional()?
        .unwrap_or(false);
    if !template_exists {
        return Err(AppError::new(
            "template_not_found",
            format!("Het sjabloon met id {template_id} bestaat niet (meer)."),
        ));
    }
    let default_status = todos::default_status_id(conn)?;

    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "INSERT INTO project (name, color, template_id, state, created_at)
         VALUES (?1, ?2, ?3, 'active', ?4)",
        params![name, color, template_id, now],
    )?;
    let project_id = tx.last_insert_rowid();

    let template_todos: Vec<(i64, i64, String, String)> = {
        let mut stmt = tx.prepare(
            "SELECT id, position, title, description FROM todo_template
             WHERE template_id = ?1 ORDER BY position",
        )?;
        let rows = stmt
            .query_map(params![template_id], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
            })?
            .collect::<Result<_, _>>()?;
        rows
    };

    for (tt_id, position, title, description) in template_todos {
        tx.execute(
            "INSERT INTO todo (project_id, position, title, description, status_id, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                project_id,
                position,
                title,
                description,
                default_status,
                now
            ],
        )?;
        let todo_id = tx.last_insert_rowid();
        statuses::append_status_event(&tx, todo_id, default_status, now)?;

        // links: url + optionele titel, 1-op-1.
        tx.execute(
            "INSERT INTO link (todo_id, url, title)
             SELECT ?1, url, title FROM todo_template_link WHERE todo_template_id = ?2",
            params![todo_id, tt_id],
        )?;

        // kenmerkwaarden: scalair + select (one row per gekozen optie).
        tx.execute(
            "INSERT INTO todo_attribute_value
                (todo_id, attribute_id, value_text, value_number, value_date, value_bool, option_id)
             SELECT ?1, attribute_id, value_text, value_number, value_date, value_bool, option_id
             FROM todo_template_attribute_value WHERE todo_template_id = ?2",
            params![todo_id, tt_id],
        )?;

        // herinneringdefinities: definitiekolommen 1-op-1; geen runtime.
        tx.execute(
            "INSERT INTO reminder
                (todo_id, mode, fire_at_literal, anchor, basis, trigger_status_id,
                 offset_value, offset_unit, offset_direction, fire_time, created_at)
             SELECT ?1, mode, fire_at_literal, anchor, basis, trigger_status_id,
                    offset_value, offset_unit, offset_direction, fire_time, ?2
             FROM todo_template_reminder WHERE todo_template_id = ?3",
            params![todo_id, now, tt_id],
        )?;
    }
    tx.commit()?;

    derive_project_state(conn, project_id, now)?;
    get_project(conn, project_id)
}

// --- toestand ----------------------------------------------------------

/// Herbepaal `active`/`completed` en zet/wis `completed_at`. Raakt een
/// gearchiveerd project niet aan. Wordt aangeroepen na élke taakmutatie die de
/// afgerond-verhouding kan wijzigen.
pub fn derive_project_state(conn: &Connection, project_id: i64, now: &str) -> AppResult<()> {
    let row: Option<(String, i64, i64)> = conn
        .query_row(
            "SELECT p.state,
                    (SELECT COUNT(*) FROM todo t WHERE t.project_id = p.id),
                    (SELECT COUNT(*) FROM todo t JOIN status s ON s.id = t.status_id
                     WHERE t.project_id = p.id AND s.is_done = 1)
             FROM project p WHERE p.id = ?1",
            params![project_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()?;
    let Some((state, total, done)) = row else {
        return Ok(());
    };
    if state == "archived" {
        return Ok(());
    }

    let should_complete = total > 0 && done == total;
    if should_complete && state != "completed" {
        conn.execute(
            "UPDATE project SET state = 'completed', completed_at = ?2 WHERE id = ?1",
            params![project_id, now],
        )?;
    } else if !should_complete && state != "active" {
        conn.execute(
            "UPDATE project SET state = 'active', completed_at = NULL WHERE id = ?1",
            params![project_id],
        )?;
    }
    Ok(())
}

// --- ···-acties (spec §2.2) --------------------------------------

pub fn update_project(
    conn: &Connection,
    id: i64,
    name: Option<&str>,
    color: Option<&str>,
) -> AppResult<Project> {
    ensure_project(conn, id)?;
    if let Some(name) = name {
        if name.trim().is_empty() {
            return Err(AppError::new(
                "project_name_empty",
                "Geef het project een naam.",
            ));
        }
        conn.execute(
            "UPDATE project SET name = ?1 WHERE id = ?2",
            params![name.trim(), id],
        )?;
    }
    if let Some(color) = color {
        conn.execute(
            "UPDATE project SET color = ?1 WHERE id = ?2",
            params![color, id],
        )?;
    }
    get_project(conn, id)
}

/// Dupliceer een project (spec §2.2): zelfde taken, posities, links,
/// kenmerkwaarden; **zonder deadlines**; alle taakstatussen terug op de
/// standaardstatus; herinneringdefinities gekopieerd zonder runtime. Eigen
/// naam; start als `active`.
pub fn duplicate_project(conn: &Connection, id: i64, now: &str) -> AppResult<Project> {
    let src = get_project(conn, id)?;
    let default_status = todos::default_status_id(conn)?;
    let new_name = format!("{} (kopie)", src.name);

    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "INSERT INTO project (name, color, template_id, state, created_at)
         VALUES (?1, ?2, ?3, 'active', ?4)",
        params![new_name, src.color, src.template_id, now],
    )?;
    let new_project = tx.last_insert_rowid();

    let src_todos: Vec<(i64, Option<i64>, String, String)> = {
        let mut stmt = tx.prepare(
            "SELECT id, position, title, description FROM todo
             WHERE project_id = ?1 ORDER BY position IS NULL, position, id",
        )?;
        let rows = stmt
            .query_map(params![id], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
            })?
            .collect::<Result<_, _>>()?;
        rows
    };

    for (old_todo, position, title, description) in src_todos {
        tx.execute(
            "INSERT INTO todo (project_id, position, title, description, status_id, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                new_project,
                position,
                title,
                description,
                default_status,
                now
            ],
        )?;
        let new_todo = tx.last_insert_rowid();
        statuses::append_status_event(&tx, new_todo, default_status, now)?;
        todos::copy_links(&tx, old_todo, new_todo)?;
        todos::copy_attribute_values(&tx, old_todo, new_todo)?;
        todos::copy_reminder_defs(&tx, old_todo, new_todo, now)?;
    }
    tx.commit()?;

    derive_project_state(conn, new_project, now)?;
    get_project(conn, new_project)
}

/// Archiveer een project (spec §2.1). Verdwijnt uit de views; openstaande
/// herinneringen stoppen (recalc).
pub fn archive_project(conn: &Connection, id: i64, now: &str) -> AppResult<Project> {
    ensure_project(conn, id)?;
    conn.execute(
        "UPDATE project SET state = 'archived', archived_at = ?2 WHERE id = ?1",
        params![id, now],
    )?;
    recalc::recalc_on_archive(conn, id)?;
    get_project(conn, id)
}

/// Zet een gearchiveerd project terug (spec §2.1): toestand opnieuw afgeleid;
/// status-gebaseerde herinneringen herberekend (recalc).
pub fn unarchive_project(conn: &Connection, id: i64, now: &str) -> AppResult<Project> {
    let state = project_state(conn, id)?;
    if state != ProjectState::Archived {
        return Err(AppError::new(
            "project_not_archived",
            "Dit project is niet gearchiveerd.",
        ));
    }
    conn.execute(
        "UPDATE project SET state = 'active', archived_at = NULL WHERE id = ?1",
        params![id],
    )?;
    derive_project_state(conn, id, now)?;
    recalc::recalc_on_unarchive(conn, id)?;
    get_project(conn, id)
}

/// "Als afgerond markeren" (spec §2.2): zet elke niet-afgeronde taak op de
/// afgerond-status via het normale pad (event + done-effect). Project → completed.
pub fn mark_project_completed(conn: &Connection, id: i64, now: &str) -> AppResult<Project> {
    ensure_project(conn, id)?;
    let done = todos::done_status_id(conn)?;
    let open: Vec<i64> = {
        let mut stmt = conn.prepare(
            "SELECT t.id FROM todo t JOIN status s ON s.id = t.status_id
             WHERE t.project_id = ?1 AND s.is_done = 0 ORDER BY t.position",
        )?;
        let rows = stmt
            .query_map(params![id], |r| r.get(0))?
            .collect::<Result<_, _>>()?;
        rows
    };
    for todo_id in open {
        todos::set_todo_status(conn, todo_id, done, now)?;
    }
    derive_project_state(conn, id, now)?;
    get_project(conn, id)
}

/// Verwijder een project (spec §2.2): de **projectnaam moet letterlijk getypt**
/// worden. Verwijdert ook alle taken en herinneringen; het sjabloon blijft.
pub fn delete_project(conn: &Connection, id: i64, typed_name: &str) -> AppResult<()> {
    let name: Option<String> = conn
        .query_row("SELECT name FROM project WHERE id = ?1", params![id], |r| {
            r.get(0)
        })
        .optional()?;
    let name = name.ok_or_else(|| not_found(id))?;
    if typed_name.trim() != name {
        return Err(AppError::new(
            "project_name_mismatch",
            "De getypte naam komt niet overeen met de projectnaam. Typ de naam exact over, of archiveer het project.",
        ));
    }
    let tx = conn.unchecked_transaction()?;
    // reminders / links / status-events / kenmerkwaarden cascaden per taak;
    // de FK van todo naar project is SET NULL, dus taken expliciet weg.
    tx.execute("DELETE FROM todo WHERE project_id = ?1", params![id])?;
    tx.execute("DELETE FROM project WHERE id = ?1", params![id])?;
    tx.commit()?;
    Ok(())
}

// --- helpers -----------------------------------------------------

fn project_state(conn: &Connection, id: i64) -> AppResult<ProjectState> {
    let s: Option<String> = conn
        .query_row(
            "SELECT state FROM project WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .optional()?;
    s.and_then(|s| ProjectState::parse(&s))
        .ok_or_else(|| not_found(id))
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
        Err(not_found(id))
    }
}

fn not_found(id: i64) -> AppError {
    AppError::new(
        "project_not_found",
        format!("Het project met id {id} bestaat niet (meer)."),
    )
}
