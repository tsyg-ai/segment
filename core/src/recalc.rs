//! Recalculation hooks for the herinneringen-engine (spec §6.4).
//!
//! This module owns every mutatiepunt that can change a resolved `fire_at` (taak
//! toegevoegd / herschikt / verplaatst / verwijderd, deadline gewijzigd, status
//! gewijzigd, project gearchiveerd of teruggezet) and calls the matching hook
//! here. **The herinneringen-engine fills the bodies:** each delegates to [`crate::reminders`],
//! which re-resolves exactly the affected reminders inside its own transaction.
//! The call sites and their signatures are untouched.

use rusqlite::Connection;

use crate::error::AppResult;
use crate::reminders;

/// Re-resolve every reminder attached directly to `todo_id`.
pub fn recalc_reminders_for_todo(conn: &Connection, todo_id: i64) -> AppResult<()> {
    reminders::recalc_for_todo(conn, todo_id)
}

/// Re-resolve vorige/volgende-taak reminders on the neighbours of a changed
/// position within a project.
pub fn recalc_neighbor_reminders(
    conn: &Connection,
    project_id: i64,
    changed_positions: &[i64],
) -> AppResult<()> {
    reminders::recalc_neighbors(conn, project_id, changed_positions)
}

/// Re-resolve deadline-based reminders for one taak (and its direct neighbours)
/// after its deadline changed.
pub fn recalc_deadline_based(conn: &Connection, todo_id: i64) -> AppResult<()> {
    reminders::recalc_deadline_based(conn, todo_id)
}

/// A project was archived — its open reminders must stop (spec §2.1).
pub fn recalc_on_archive(conn: &Connection, project_id: i64) -> AppResult<()> {
    reminders::recalc_on_archive(conn, project_id)
}

/// A project was un-archived — reminders are recomputed and may fire late
/// (spec §2.1).
pub fn recalc_on_unarchive(conn: &Connection, project_id: i64) -> AppResult<()> {
    reminders::recalc_on_unarchive(conn, project_id)
}
