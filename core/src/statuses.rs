//! Status CRUD, ordering and the `is_default` / `is_done` invariants
//! (spec §5), plus the shared `append_status_event` helper (spec §5.1).
//!
//! Invariants enforced here, never in the UI:
//!   * the one `is_default` row and the one `is_done` row are seeded once
//!     (`seed::seed_default_statuses`) and can only be renamed — never moved,
//!     cleared or deleted;
//!   * `position` is a gap-free 1..n sequence;
//!   * a status with todos on it cannot be deleted without a reassignment
//!     target; on delete its todos move and any `reminder.trigger_status_id`
//!     pointing at it is rewritten to the target.

use rusqlite::{params, Connection, OptionalExtension};

use crate::error::{AppError, AppResult};
use crate::models::{Status, StatusInput};

/// All statuses, ordered by `position`, each with its live `todo_count`.
pub fn list(conn: &Connection) -> AppResult<Vec<Status>> {
    let mut stmt = conn.prepare(
        "SELECT s.id, s.name, s.color, s.position, s.is_default, s.is_done,
                (SELECT COUNT(*) FROM todo t WHERE t.status_id = s.id)
         FROM status s
         ORDER BY s.position",
    )?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Status {
                id: r.get(0)?,
                name: r.get(1)?,
                color: r.get(2)?,
                position: r.get(3)?,
                is_default: r.get::<_, i64>(4)? != 0,
                is_done: r.get::<_, i64>(5)? != 0,
                todo_count: r.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

/// Create a status. It is inserted **just before the done-status** in the
/// order (mockup: "komt voor Klaar in de volgorde"). New statuses never carry
/// the `is_default` or `is_done` marking — those are seeded once and only
/// renamed.
pub fn create(conn: &Connection, input: StatusInput) -> AppResult<Status> {
    validate_name(&input.name)?;
    let tx = conn.unchecked_transaction()?;

    let done_pos: Option<i64> = tx
        .query_row(
            "SELECT position FROM status WHERE is_done = 1 LIMIT 1",
            [],
            |r| r.get(0),
        )
        .optional()?;
    let max_pos: i64 = tx.query_row("SELECT COALESCE(MAX(position), 0) FROM status", [], |r| {
        r.get(0)
    })?;
    let insert_pos = done_pos.unwrap_or(max_pos + 1);

    tx.execute(
        "UPDATE status SET position = position + 1 WHERE position >= ?1",
        params![insert_pos],
    )?;
    tx.execute(
        "INSERT INTO status (name, color, position, is_default, is_done)
         VALUES (?1, ?2, ?3, 0, 0)",
        params![input.name.trim(), input.color, insert_pos],
    )?;
    let id = tx.last_insert_rowid();
    tx.commit()?;

    get(conn, id)
}

/// Update a status's `name` and `color`. The `is_default` / `is_done` markings
/// are untouched — a seeded status can only be renamed. `reorder_statuses`
/// owns ordering.
pub fn update(conn: &Connection, id: i64, input: StatusInput) -> AppResult<Status> {
    validate_name(&input.name)?;
    let affected = conn.execute(
        "UPDATE status SET name = ?1, color = ?2 WHERE id = ?3",
        params![input.name.trim(), input.color, id],
    )?;
    if affected == 0 {
        return Err(not_found(id));
    }
    get(conn, id)
}

/// Delete a status. `reassign_to` is required whenever todos still sit on it:
/// those todos move to the target, any `reminder.trigger_status_id` pointing at
/// the deleted status is rewritten to the target and flagged for recalculation,
/// and a `todo_status_event` is appended for every moved todo.
/// The last remaining status, the default-status and the done-status cannot be
/// deleted.
pub fn delete(conn: &Connection, id: i64, reassign_to: Option<i64>, now: &str) -> AppResult<()> {
    let row: Option<(i64, i64, i64)> = conn
        .query_row(
            "SELECT position, is_default, is_done FROM status WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()?;
    let (position, is_default, is_done) = row.ok_or_else(|| not_found(id))?;

    let total: i64 = conn.query_row("SELECT COUNT(*) FROM status", [], |r| r.get(0))?;
    if total <= 1 {
        return Err(AppError::new(
            "status_last",
            "De laatste status kan niet verwijderd worden.",
        ));
    }
    if is_default != 0 {
        return Err(AppError::new(
            "status_is_default",
            "De standaardstatus kan niet verwijderd worden, alleen hernoemd.",
        ));
    }
    if is_done != 0 {
        return Err(AppError::new(
            "status_is_done",
            "De afgerond-status kan niet verwijderd worden, alleen hernoemd.",
        ));
    }

    let todo_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM todo WHERE status_id = ?1",
        params![id],
        |r| r.get(0),
    )?;
    // `todo_status_event.status_id` is ON DELETE RESTRICT, so any history on
    // this status also blocks the delete and needs a reassignment target.
    let event_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM todo_status_event WHERE status_id = ?1",
        params![id],
        |r| r.get(0),
    )?;

    let tx = conn.unchecked_transaction()?;

    if todo_count > 0 || event_count > 0 {
        let target = reassign_to.ok_or_else(|| {
            AppError::new(
                "status_reassign_required",
                format!(
                    "Er staan nog {todo_count} taken op deze status. Kies eerst een andere status om ze naartoe te verplaatsen."
                ),
            )
        })?;
        if target == id {
            return Err(AppError::new(
                "status_reassign_self",
                "De hertoewijzing moet naar een andere status wijzen.",
            ));
        }
        let target_exists: bool = tx
            .query_row(
                "SELECT 1 FROM status WHERE id = ?1",
                params![target],
                |_| Ok(true),
            )
            .optional()?
            .unwrap_or(false);
        if !target_exists {
            return Err(not_found(target));
        }

        // Log the move for every affected todo, then move them.
        {
            let mut ids = tx.prepare("SELECT id FROM todo WHERE status_id = ?1")?;
            let todo_ids = ids
                .query_map(params![id], |r| r.get(0))?
                .collect::<Result<Vec<i64>, _>>()?;
            for todo_id in todo_ids {
                append_status_event(&tx, todo_id, target, now)?;
            }
        }
        tx.execute(
            "UPDATE todo SET status_id = ?1 WHERE status_id = ?2",
            params![target, id],
        )?;
        // The append-only statuslog cannot keep a row on a deleted status
        // (RESTRICT); repoint its history to the target so status-based
        // reminders keep a usable ankermoment (spec §6.4 cascade).
        tx.execute(
            "UPDATE todo_status_event SET status_id = ?1 WHERE status_id = ?2",
            params![target, id],
        )?;

        // Status-based reminders that counted from the removed status move with
        // the todos and are marked for recalculation (the recalc itself lives
        // in the herinneringen-engine — here we just rewrite the pointer and
        // call the hook).
        tx.execute(
            "UPDATE reminder SET trigger_status_id = ?1
             WHERE trigger_status_id = ?2",
            params![target, id],
        )?;
        tx.execute(
            "UPDATE todo_template_reminder SET trigger_status_id = ?1
             WHERE trigger_status_id = ?2",
            params![target, id],
        )?;
    }

    tx.execute("DELETE FROM status WHERE id = ?1", params![id])?;
    tx.execute(
        "UPDATE status SET position = position - 1 WHERE position > ?1",
        params![position],
    )?;
    tx.commit()?;

    if let Some(target) = reassign_to {
        recalc_status_based_for_status(conn, target)?;
    }
    Ok(())
}

/// Persist a new order. `ids_in_order` must be exactly the current status ids,
/// each once; positions become 1..n in that order.
pub fn reorder(conn: &Connection, ids_in_order: &[i64]) -> AppResult<Vec<Status>> {
    let current: Vec<i64> = {
        let mut stmt = conn.prepare("SELECT id FROM status")?;
        let ids = stmt
            .query_map([], |r| r.get(0))?
            .collect::<Result<Vec<i64>, _>>()?;
        ids
    };
    if ids_in_order.len() != current.len() || !current.iter().all(|id| ids_in_order.contains(id)) {
        return Err(AppError::new(
            "status_reorder_mismatch",
            "De doorgegeven volgorde komt niet overeen met de bestaande statussen.",
        ));
    }
    let tx = conn.unchecked_transaction()?;
    // Two-phase to dodge any future UNIQUE(position): park high, then set.
    for id in ids_in_order {
        tx.execute(
            "UPDATE status SET position = position + 100000 WHERE id = ?1",
            params![id],
        )?;
    }
    for (i, id) in ids_in_order.iter().enumerate() {
        tx.execute(
            "UPDATE status SET position = ?1 WHERE id = ?2",
            params![i as i64 + 1, id],
        )?;
    }
    tx.commit()?;
    list(conn)
}

/// Append-only status log (spec §5.1). Multiple rows per (todo, status) are
/// allowed; readers sort on `entered_at`. Called from here on reassignment and
/// on task status change, snapshot instantiation and kanban drag.
pub fn append_status_event(
    conn: &Connection,
    todo_id: i64,
    status_id: i64,
    at: &str,
) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO todo_status_event (todo_id, status_id, entered_at)
         VALUES (?1, ?2, ?3)",
        params![todo_id, status_id, at],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Recalculate status-based reminders that count from `status_id`.
/// Status reassignment rewrites `trigger_status_id` and calls this.
pub fn recalc_status_based_for_status(conn: &Connection, status_id: i64) -> AppResult<()> {
    crate::reminders::recalc_status_based_for_status(conn, status_id)
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Status> {
    list(conn)?
        .into_iter()
        .find(|s| s.id == id)
        .ok_or_else(|| not_found(id))
}

fn validate_name(name: &str) -> AppResult<()> {
    if name.trim().is_empty() {
        return Err(AppError::new(
            "status_name_empty",
            "Geef de status een naam.",
        ));
    }
    Ok(())
}

fn not_found(id: i64) -> AppError {
    AppError::new(
        "status_not_found",
        format!("De status met id {id} bestaat niet (meer)."),
    )
}
