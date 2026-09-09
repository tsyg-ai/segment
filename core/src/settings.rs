use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::clock::now_local_iso;
use crate::error::AppResult;

/// The single `user_settings` row, round-tripped via serde.
/// `column_config` is opaque per-view table-column configuration (JSON);
/// the takenviews own its shape.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
    /// Always true in v1 (spec).
    pub run_in_background: bool,
    /// Default false, not UI-configurable in v1 (spec).
    pub autostart: bool,
    pub last_active_at: Option<String>,
    pub last_update_check_at: Option<String>,
    pub column_config: Value,
}

impl Default for UserSettings {
    fn default() -> Self {
        Self {
            run_in_background: true,
            autostart: false,
            last_active_at: None,
            last_update_check_at: None,
            column_config: Value::Object(Default::default()),
        }
    }
}

/// Read the settings row, creating it with defaults if it does not exist yet.
pub fn get(conn: &Connection) -> AppResult<UserSettings> {
    ensure_row(conn)?;
    let s = conn.query_row(
        "SELECT run_in_background, autostart, last_active_at,
                last_update_check_at, column_config
         FROM user_settings WHERE id = 1",
        [],
        |r| {
            let column_config: String = r.get(4)?;
            Ok(UserSettings {
                run_in_background: r.get::<_, i64>(0)? != 0,
                autostart: r.get::<_, i64>(1)? != 0,
                last_active_at: r.get(2)?,
                last_update_check_at: r.get(3)?,
                column_config: serde_json::from_str(&column_config)
                    .unwrap_or_else(|_| Value::Object(Default::default())),
            })
        },
    )?;
    Ok(s)
}

/// Persist the settings row. `run_in_background` is forced on in v1 (spec).
pub fn set(conn: &Connection, mut settings: UserSettings) -> AppResult<UserSettings> {
    settings.run_in_background = true;
    ensure_row(conn)?;
    conn.execute(
        "UPDATE user_settings SET
            run_in_background = ?1,
            autostart = ?2,
            last_active_at = ?3,
            last_update_check_at = ?4,
            column_config = ?5
         WHERE id = 1",
        rusqlite::params![
            settings.run_in_background as i64,
            settings.autostart as i64,
            settings.last_active_at,
            settings.last_update_check_at,
            serde_json::to_string(&settings.column_config)?,
        ],
    )?;
    Ok(settings)
}

/// Stamp `last_update_check_at` with local now — written after every daily
/// update check, **including a silent offline no-op**.
pub fn touch_last_update_check(conn: &Connection) -> AppResult<()> {
    ensure_row(conn)?;
    conn.execute(
        "UPDATE user_settings SET last_update_check_at = ?1 WHERE id = 1",
        rusqlite::params![now_local_iso()],
    )?;
    Ok(())
}

/// Whether the daily update check should run: never checked, or the previous
/// check's local *date* is before today's ("dagelijks"). Pure so
/// the cadence is unit-testable without a clock.
pub fn update_check_due(last_check: Option<&str>, now: &str) -> bool {
    match last_check {
        None => true,
        Some(prev) => prev.get(0..10).unwrap_or("") < now.get(0..10).unwrap_or(""),
    }
}

/// Stamp `last_active_at` with local now — called on startup and on shutdown.
pub fn touch_last_active(conn: &Connection) -> AppResult<()> {
    ensure_row(conn)?;
    conn.execute(
        "UPDATE user_settings SET last_active_at = ?1 WHERE id = 1",
        rusqlite::params![now_local_iso()],
    )?;
    Ok(())
}

fn ensure_row(conn: &Connection) -> AppResult<()> {
    let exists: Option<i64> = conn
        .query_row("SELECT id FROM user_settings WHERE id = 1", [], |r| {
            r.get(0)
        })
        .optional()?;
    if exists.is_none() {
        conn.execute(
            "INSERT INTO user_settings (id, run_in_background, autostart, column_config)
             VALUES (1, 1, 0, '{}')",
            [],
        )?;
    }
    Ok(())
}
