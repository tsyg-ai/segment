use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;

use crate::error::{AppError, AppResult};
use crate::{migrations, seed};

/// Owns the one SQLite connection, behind a `Mutex` (synchronous access is fine
/// at this scale — spec "Persistentie"). Migrations run at construction; the
/// default statuses are seeded once.
pub struct Db {
    conn: Mutex<Connection>,
}

impl Db {
    /// Open (or create) the database file at `path`, run migrations, seed.
    pub fn open(path: impl AsRef<Path>) -> AppResult<Self> {
        let mut conn = Connection::open(path.as_ref()).map_err(AppError::migration)?;
        Self::init(&mut conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// An in-memory database — used by tests.
    pub fn open_in_memory() -> AppResult<Self> {
        let mut conn = Connection::open_in_memory().map_err(AppError::migration)?;
        Self::init(&mut conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    fn init(conn: &mut Connection) -> AppResult<()> {
        migrations::run(conn)?;
        seed::seed_default_statuses(conn)?;
        Ok(())
    }

    /// Run a closure with the connection. Poisoned-lock recovery keeps a panic
    /// in one command from bricking the whole app.
    pub fn with_conn<T>(&self, f: impl FnOnce(&Connection) -> AppResult<T>) -> AppResult<T> {
        let guard = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        f(&guard)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn table_names(db: &Db) -> Vec<String> {
        db.with_conn(|c| {
            let mut stmt = c.prepare(
                "SELECT name FROM sqlite_master
                 WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
                 ORDER BY name",
            )?;
            let names = stmt
                .query_map([], |r| r.get::<_, String>(0))?
                .collect::<Result<Vec<_>, _>>()?;
            Ok(names)
        })
        .unwrap()
    }

    fn index_names(db: &Db) -> Vec<String> {
        db.with_conn(|c| {
            let mut stmt = c.prepare(
                "SELECT name FROM sqlite_master
                 WHERE type = 'index' AND name LIKE 'idx_%'
                 ORDER BY name",
            )?;
            let names = stmt
                .query_map([], |r| r.get::<_, String>(0))?
                .collect::<Result<Vec<_>, _>>()?;
            Ok(names)
        })
        .unwrap()
    }

    #[test]
    fn migration_0001_creates_every_table() {
        let db = Db::open_in_memory().unwrap();
        let tables = table_names(&db);
        for expected in [
            "attribute_definition",
            "attribute_option",
            "link",
            "project",
            "project_template",
            "reminder",
            "status",
            "todo",
            "todo_attribute_value",
            "todo_status_event",
            "todo_template",
            "user_settings",
        ] {
            assert!(
                tables.iter().any(|t| t == expected),
                "missing table {expected}; got {tables:?}"
            );
        }
    }

    #[test]
    fn migration_0001_creates_expected_indexes() {
        let db = Db::open_in_memory().unwrap();
        let indexes = index_names(&db);
        for expected in [
            "idx_todo_status_event_lookup",
            "idx_reminder_pending",
            "idx_status_single_default",
            "idx_todo_attribute_value_scalar",
        ] {
            assert!(
                indexes.iter().any(|i| i == expected),
                "missing index {expected}; got {indexes:?}"
            );
        }
    }

    #[test]
    fn migrations_run_clean_and_are_idempotent() {
        // The migration set validates (ordering + every `up` parses)...
        assert!(migrations::migrations().validate().is_ok());
        // ...and re-running `run` on an already-migrated connection is a no-op.
        let db = Db::open_in_memory().unwrap();
        db.with_conn(|_| Ok(())).unwrap();
        let mut fresh = Connection::open_in_memory().unwrap();
        migrations::run(&mut fresh).unwrap();
        migrations::run(&mut fresh).unwrap();
    }

    #[test]
    fn foreign_keys_are_enforced() {
        let db = Db::open_in_memory().unwrap();
        let fk_on: i64 = db
            .with_conn(|c| Ok(c.query_row("PRAGMA foreign_keys", [], |r| r.get(0))?))
            .unwrap();
        assert_eq!(fk_on, 1);
    }
}
