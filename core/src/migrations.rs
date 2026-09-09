use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};

use crate::error::AppResult;

/// Versioned schema migrations, run at startup. New features append
/// `M::up(include_str!("migrations/000N_*.sql"))` here — never edit 0001.
pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("migrations/0001_initial.sql")),
        M::up(include_str!("migrations/0002_template_values.sql")),
        M::up(include_str!("migrations/0003_reminder_fired_late.sql")),
        M::up(include_str!("migrations/0004_todo_template_link.sql")),
        M::up(include_str!("migrations/0005_attribute_value_time.sql")),
        M::up(include_str!("migrations/0006_drop_number_decimals.sql")),
    ])
}

/// Bring `conn` to the latest schema version. A failure here is fatal and must
/// be shown to the user as a clear Dutch message.
pub fn run(conn: &mut Connection) -> AppResult<()> {
    conn.pragma_update(None, "foreign_keys", "ON")?;
    migrations().to_latest(conn)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_valid() {
        // rusqlite_migration validates ordering + that every `up` parses.
        assert!(migrations().validate().is_ok());
    }
}
