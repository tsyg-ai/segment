use rusqlite::Connection;

use crate::clock::now_local_iso;
use crate::error::AppResult;
use crate::models::Status;

/// Colours are taken from the functional ramp (designs/tokens/colors.css):
///   Te doen → ink-500 (grey, "te doen"), Bezig → ochre-600 ("bezig"),
///   Klaar   → teal-600 (accent / "done").
const DEFAULT_STATUSES: [(&str, &str, i64, bool, bool); 3] = [
    ("Te doen", "#5E6A65", 1, true, false),
    ("Bezig", "#96701A", 2, false, false),
    ("Klaar", "#1F6F66", 3, false, true),
];

/// Seed the three default statuses — but only when `status` is empty
/// (spec §5, §11). Idempotent: a second call on a non-empty table is a no-op.
pub fn seed_default_statuses(conn: &Connection) -> AppResult<bool> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM status", [], |r| r.get(0))?;
    if count > 0 {
        return Ok(false);
    }

    let now = now_local_iso();
    let tx = conn.unchecked_transaction()?;
    for (name, color, position, is_default, is_done) in DEFAULT_STATUSES {
        tx.execute(
            "INSERT INTO status (name, color, position, is_default, is_done)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![name, color, position, is_default as i64, is_done as i64],
        )?;
    }
    // `last_active_at` also gets its first value here so the dashboard has a
    // baseline; the settings row is created if missing.
    tx.execute(
        "INSERT INTO user_settings (id, last_active_at) VALUES (1, ?1)
         ON CONFLICT(id) DO NOTHING",
        rusqlite::params![now],
    )?;
    tx.commit()?;
    Ok(true)
}

/// All statuses ordered by `position` (used by the seed test and `list_statuses`).
pub fn list_statuses(conn: &Connection) -> AppResult<Vec<Status>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, color, position, is_default, is_done
         FROM status ORDER BY position",
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
                todo_count: 0,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}
