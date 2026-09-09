//! Kenmerk (`attribute_definition`) CRUD, options and the snapshot logic
//! (spec §4).
//!
//! Rules enforced here:
//!   * `type` is set on create and is read-only afterwards — there is no path
//!     that changes it;
//!   * scope may only move `project -> global`; all existing task values are
//!     kept; `global -> project` is refused;
//!   * a fresh `global` kenmerk needs no backfill — the representation is
//!     "no row = empty", so it is instantly visible-as-empty on every task
//!     (`todos_without_value` confirms this);
//!   * renaming or deleting an option always asks whether existing tasks come
//!     along; when they do not, `option_label_snapshot` preserves the label so
//!     historical values stay readable without a live option.

use rusqlite::{params, Connection, OptionalExtension};

use crate::error::{AppError, AppResult};
use crate::models::{
    AttributeDefinition, AttributeInput, AttributeOption, AttributeScope, AttributeType,
};

pub(crate) const HAS_VALUE: &str = "(option_id IS NOT NULL OR option_label_snapshot IS NOT NULL
        OR value_text IS NOT NULL OR value_number IS NOT NULL
        OR value_date IS NOT NULL OR value_time IS NOT NULL OR value_bool IS NOT NULL)";

pub fn list(conn: &Connection) -> AppResult<Vec<AttributeDefinition>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, type, scope, template_id, select_multiple, text_multiline,
                number_unit, checkbox_default
         FROM attribute_definition
         ORDER BY scope, name",
    )?;
    let mut defs: Vec<AttributeDefinition> = stmt
        .query_map([], |r| {
            let type_str: String = r.get(2)?;
            let scope_str: String = r.get(3)?;
            Ok(AttributeDefinition {
                id: r.get(0)?,
                name: r.get(1)?,
                type_: AttributeType::parse(&type_str).unwrap_or(AttributeType::Text),
                scope: if scope_str == "project" {
                    AttributeScope::Project
                } else {
                    AttributeScope::Global
                },
                template_id: r.get(4)?,
                select_multiple: r.get::<_, i64>(5)? != 0,
                text_multiline: r.get::<_, i64>(6)? != 0,
                number_unit: r.get(7)?,
                checkbox_default: r.get::<_, i64>(8)? != 0,
                options: Vec::new(),
                value_count: 0,
            })
        })?
        .collect::<Result<_, _>>()?;

    for def in &mut defs {
        def.options = list_options(conn, def.id)?;
        def.value_count = conn.query_row(
            &format!(
                "SELECT COUNT(DISTINCT todo_id) FROM todo_attribute_value
                 WHERE attribute_id = ?1 AND {HAS_VALUE}"
            ),
            params![def.id],
            |r| r.get(0),
        )?;
    }
    Ok(defs)
}

pub fn get(conn: &Connection, id: i64) -> AppResult<AttributeDefinition> {
    list(conn)?
        .into_iter()
        .find(|d| d.id == id)
        .ok_or_else(|| not_found(id))
}

pub fn create(
    conn: &Connection,
    input: AttributeInput,
    now: &str,
) -> AppResult<AttributeDefinition> {
    if input.name.trim().is_empty() {
        return Err(AppError::new(
            "attribute_name_empty",
            "Geef het kenmerk een naam.",
        ));
    }
    let (scope_str, template_id) = match input.scope {
        AttributeScope::Global => ("global", None),
        AttributeScope::Project => {
            let tid = input.template_id.ok_or_else(|| {
                AppError::new(
                    "attribute_scope_template_missing",
                    "Een projectkenmerk hoort bij één sjabloon; geef het sjabloon op.",
                )
            })?;
            ("project", Some(tid))
        }
    };
    conn.execute(
        "INSERT INTO attribute_definition
            (name, type, scope, template_id, select_multiple, text_multiline,
             number_unit, checkbox_default, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            input.name.trim(),
            input.type_.as_str(),
            scope_str,
            template_id,
            input.select_multiple as i64,
            input.text_multiline as i64,
            input
                .number_unit
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty()),
            input.checkbox_default as i64,
            now,
        ],
    )?;
    // No backfill: "no row = empty" is the representation. A fresh global
    // kenmerk is already visible-as-empty on every task (see
    // `todos_without_value`).
    get(conn, conn.last_insert_rowid())
}

/// Update the name and the type-specific settings. `type` and `scope` are not
/// touched here (type is immutable; scope goes through `set_scope`).
pub fn update(conn: &Connection, id: i64, input: AttributeInput) -> AppResult<AttributeDefinition> {
    if input.name.trim().is_empty() {
        return Err(AppError::new(
            "attribute_name_empty",
            "Geef het kenmerk een naam.",
        ));
    }
    let affected = conn.execute(
        "UPDATE attribute_definition SET
            name = ?1, select_multiple = ?2, text_multiline = ?3,
            number_unit = ?4, checkbox_default = ?5
         WHERE id = ?6",
        params![
            input.name.trim(),
            input.select_multiple as i64,
            input.text_multiline as i64,
            input
                .number_unit
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty()),
            input.checkbox_default as i64,
            id,
        ],
    )?;
    if affected == 0 {
        return Err(not_found(id));
    }
    get(conn, id)
}

/// Delete the kenmerk. `todo_attribute_value` rows cascade away with it
/// (FK `ON DELETE CASCADE`); the UI shows a confirmation first.
pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    let affected = conn.execute(
        "DELETE FROM attribute_definition WHERE id = ?1",
        params![id],
    )?;
    if affected == 0 {
        return Err(not_found(id));
    }
    Ok(())
}

/// Move the scope. Only `project -> global` is allowed; task values are kept.
pub fn set_scope(
    conn: &Connection,
    id: i64,
    scope: AttributeScope,
) -> AppResult<AttributeDefinition> {
    let current: String = conn
        .query_row(
            "SELECT scope FROM attribute_definition WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .optional()?
        .ok_or_else(|| not_found(id))?;

    match (current.as_str(), scope) {
        ("project", AttributeScope::Global) => {
            conn.execute(
                "UPDATE attribute_definition
                 SET scope = 'global', template_id = NULL WHERE id = ?1",
                params![id],
            )?;
        }
        ("global", AttributeScope::Project) => {
            return Err(AppError::new(
                "attribute_scope_narrowing",
                "Een global kenmerk kan later niet meer aan één sjabloon gekoppeld worden.",
            ));
        }
        _ => {} // no-op: already in the requested scope
    }
    get(conn, id)
}

// --- options ---------------------------------------------------------------

pub fn list_options(conn: &Connection, attribute_id: i64) -> AppResult<Vec<AttributeOption>> {
    let mut stmt = conn.prepare(
        "SELECT o.id, o.attribute_id, o.label, o.position,
                (SELECT COUNT(DISTINCT v.todo_id) FROM todo_attribute_value v
                 WHERE v.option_id = o.id)
         FROM attribute_option o
         WHERE o.attribute_id = ?1
         ORDER BY o.position",
    )?;
    let rows = stmt
        .query_map(params![attribute_id], |r| {
            Ok(AttributeOption {
                id: r.get(0)?,
                attribute_id: r.get(1)?,
                label: r.get(2)?,
                position: r.get(3)?,
                value_count: r.get(4)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(rows)
}

pub fn create_option(
    conn: &Connection,
    attribute_id: i64,
    label: &str,
) -> AppResult<AttributeOption> {
    if label.trim().is_empty() {
        return Err(AppError::new(
            "option_label_empty",
            "Geef de optie een label.",
        ));
    }
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM attribute_definition WHERE id = ?1 AND type = 'select'",
            params![attribute_id],
            |_| Ok(true),
        )
        .optional()?
        .unwrap_or(false);
    if !exists {
        return Err(AppError::new(
            "option_wrong_type",
            "Opties horen alleen bij een keuzelijst-kenmerk.",
        ));
    }
    let next_pos: i64 = conn.query_row(
        "SELECT COALESCE(MAX(position), 0) + 1 FROM attribute_option WHERE attribute_id = ?1",
        params![attribute_id],
        |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO attribute_option (attribute_id, label, position) VALUES (?1, ?2, ?3)",
        params![attribute_id, label.trim(), next_pos],
    )?;
    let id = conn.last_insert_rowid();
    Ok(list_options(conn, attribute_id)?
        .into_iter()
        .find(|o| o.id == id)
        .expect("just inserted"))
}

/// Rename an option. `apply_to_existing` decides the snapshot behaviour:
///   * `true`  — every referencing task reads the new label; snapshots cleared.
///   * `false` — referencing tasks keep the **old** label via
///     `option_label_snapshot`; the new name only applies to what is filled in
///     afterwards.
pub fn rename_option(
    conn: &Connection,
    option_id: i64,
    new_label: &str,
    apply_to_existing: bool,
) -> AppResult<AttributeOption> {
    if new_label.trim().is_empty() {
        return Err(AppError::new(
            "option_label_empty",
            "Geef de optie een label.",
        ));
    }
    let (attribute_id, old_label): (i64, String) = conn
        .query_row(
            "SELECT attribute_id, label FROM attribute_option WHERE id = ?1",
            params![option_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?
        .ok_or_else(|| option_not_found(option_id))?;

    let tx = conn.unchecked_transaction()?;
    if apply_to_existing {
        tx.execute(
            "UPDATE todo_attribute_value SET option_label_snapshot = NULL WHERE option_id = ?1",
            params![option_id],
        )?;
    } else {
        tx.execute(
            "UPDATE todo_attribute_value
             SET option_label_snapshot = ?1
             WHERE option_id = ?2 AND option_label_snapshot IS NULL",
            params![old_label, option_id],
        )?;
    }
    tx.execute(
        "UPDATE attribute_option SET label = ?1 WHERE id = ?2",
        params![new_label.trim(), option_id],
    )?;
    tx.commit()?;

    Ok(list_options(conn, attribute_id)?
        .into_iter()
        .find(|o| o.id == option_id)
        .expect("just renamed"))
}

/// Delete an option. `clear_values`:
///   * `true`  — referencing `todo_attribute_value` rows are removed too.
///   * `false` — those rows keep a `option_label_snapshot` of the label and
///     lose only the live `option_id` reference.
pub fn delete_option(conn: &Connection, option_id: i64, clear_values: bool) -> AppResult<()> {
    let (attribute_id, label): (i64, String) = conn
        .query_row(
            "SELECT attribute_id, label FROM attribute_option WHERE id = ?1",
            params![option_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?
        .ok_or_else(|| option_not_found(option_id))?;

    let tx = conn.unchecked_transaction()?;
    if clear_values {
        tx.execute(
            "DELETE FROM todo_attribute_value WHERE option_id = ?1",
            params![option_id],
        )?;
    } else {
        tx.execute(
            "UPDATE todo_attribute_value
             SET option_label_snapshot = ?1
             WHERE option_id = ?2 AND option_label_snapshot IS NULL",
            params![label, option_id],
        )?;
    }
    // FK is ON DELETE SET NULL, so any remaining rows keep their snapshot and
    // drop option_id automatically.
    tx.execute(
        "DELETE FROM attribute_option WHERE id = ?1",
        params![option_id],
    )?;
    tx.commit()?;
    // Re-normalise the surviving options to a clean 1..n.
    renumber_options(conn, attribute_id)
}

pub fn reorder_options(
    conn: &Connection,
    attribute_id: i64,
    ids_in_order: &[i64],
) -> AppResult<Vec<AttributeOption>> {
    let current: Vec<i64> = list_options(conn, attribute_id)?
        .iter()
        .map(|o| o.id)
        .collect();
    if ids_in_order.len() != current.len() || !current.iter().all(|id| ids_in_order.contains(id)) {
        return Err(AppError::new(
            "option_reorder_mismatch",
            "De doorgegeven volgorde komt niet overeen met de bestaande opties.",
        ));
    }
    let tx = conn.unchecked_transaction()?;
    for id in ids_in_order {
        tx.execute(
            "UPDATE attribute_option SET position = position + 100000 WHERE id = ?1",
            params![id],
        )?;
    }
    for (i, id) in ids_in_order.iter().enumerate() {
        tx.execute(
            "UPDATE attribute_option SET position = ?1 WHERE id = ?2",
            params![i as i64 + 1, id],
        )?;
    }
    tx.commit()?;
    list_options(conn, attribute_id)
}

// --- "Niet ingevuld" query helper ---------------------------------------

/// Ids of tasks that have **no value** for `attribute_id` — the data behind
/// the "Niet ingevuld" filter value (the filter UI itself lives in the frontend). Scope
/// aware: a project kenmerk only considers tasks in projects of its sjabloon.
pub fn todos_without_value(conn: &Connection, attribute_id: i64) -> AppResult<Vec<i64>> {
    let (scope, template_id): (String, Option<i64>) = conn
        .query_row(
            "SELECT scope, template_id FROM attribute_definition WHERE id = ?1",
            params![attribute_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?
        .ok_or_else(|| not_found(attribute_id))?;

    let sql = if scope == "project" {
        "SELECT t.id FROM todo t
         JOIN project p ON p.id = t.project_id
         WHERE p.template_id = ?2
           AND NOT EXISTS (
             SELECT 1 FROM todo_attribute_value v
             WHERE v.todo_id = t.id AND v.attribute_id = ?1 AND HAS_VALUE_PLACEHOLDER
           )
         ORDER BY t.id"
    } else {
        "SELECT t.id FROM todo t
         WHERE NOT EXISTS (
             SELECT 1 FROM todo_attribute_value v
             WHERE v.todo_id = t.id AND v.attribute_id = ?1 AND HAS_VALUE_PLACEHOLDER
           )
         ORDER BY t.id"
    };
    let sql = sql.replace("HAS_VALUE_PLACEHOLDER", HAS_VALUE);

    let mut stmt = conn.prepare(&sql)?;
    let rows: Vec<i64> = if scope == "project" {
        stmt.query_map(params![attribute_id, template_id], |r| r.get(0))?
            .collect::<Result<_, _>>()?
    } else {
        stmt.query_map(params![attribute_id], |r| r.get(0))?
            .collect::<Result<_, _>>()?
    };
    Ok(rows)
}

/// Ids of tasks that **do** have a value for `attribute_id` — the data behind
/// the "Ingevuld" filtervalue, tegenhanger van [`todos_without_value`]. Alleen
/// het bestaan van een rij met een waarde telt; scope speelt geen rol want een
/// rij impliceert dat de taak het kenmerk droeg.
pub fn todos_with_value(conn: &Connection, attribute_id: i64) -> AppResult<Vec<i64>> {
    let sql = format!(
        "SELECT DISTINCT todo_id FROM todo_attribute_value
         WHERE attribute_id = ?1 AND {HAS_VALUE}
         ORDER BY todo_id"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map(params![attribute_id], |r| r.get(0))?
        .collect::<Result<_, _>>()?;
    Ok(rows)
}

/// Ids of tasks whose **effective** checkbox value for `attribute_id` equals
/// `want`. Een taak zonder opgeslagen rij telt mee met de `checkbox_default`,
/// net zoals het detailpaneel de waarde toont. Scope-bewust: een
/// projectkenmerk kijkt enkel naar taken in projecten van zijn sjabloon.
pub fn todos_with_bool_value(
    conn: &Connection,
    attribute_id: i64,
    want: bool,
) -> AppResult<Vec<i64>> {
    let (scope, template_id, checkbox_default): (String, Option<i64>, i64) = conn
        .query_row(
            "SELECT scope, template_id, checkbox_default
             FROM attribute_definition WHERE id = ?1",
            params![attribute_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()?
        .ok_or_else(|| not_found(attribute_id))?;

    let want_i = want as i64;
    let default_matches = checkbox_default == want_i;

    let sql = if scope == "project" {
        "SELECT t.id FROM todo t
         JOIN project p ON p.id = t.project_id
         WHERE p.template_id = ?2 AND (
             EXISTS (
               SELECT 1 FROM todo_attribute_value v
               WHERE v.todo_id = t.id AND v.attribute_id = ?1 AND v.value_bool = ?3
             )
             OR (?4 AND NOT EXISTS (
               SELECT 1 FROM todo_attribute_value v
               WHERE v.todo_id = t.id AND v.attribute_id = ?1 AND HAS_VALUE_PLACEHOLDER
             ))
         )
         ORDER BY t.id"
    } else {
        "SELECT t.id FROM todo t
         WHERE (
             EXISTS (
               SELECT 1 FROM todo_attribute_value v
               WHERE v.todo_id = t.id AND v.attribute_id = ?1 AND v.value_bool = ?2
             )
             OR (?3 AND NOT EXISTS (
               SELECT 1 FROM todo_attribute_value v
               WHERE v.todo_id = t.id AND v.attribute_id = ?1 AND HAS_VALUE_PLACEHOLDER
             ))
         )
         ORDER BY t.id"
    };
    let sql = sql.replace("HAS_VALUE_PLACEHOLDER", HAS_VALUE);

    let mut stmt = conn.prepare(&sql)?;
    let rows: Vec<i64> = if scope == "project" {
        stmt.query_map(
            params![attribute_id, template_id, want_i, default_matches],
            |r| r.get(0),
        )?
        .collect::<Result<_, _>>()?
    } else {
        stmt.query_map(params![attribute_id, want_i, default_matches], |r| r.get(0))?
            .collect::<Result<_, _>>()?
    };
    Ok(rows)
}

fn renumber_options(conn: &Connection, attribute_id: i64) -> AppResult<()> {
    let ids: Vec<i64> = {
        let mut stmt = conn
            .prepare("SELECT id FROM attribute_option WHERE attribute_id = ?1 ORDER BY position")?;
        let ids = stmt
            .query_map(params![attribute_id], |r| r.get(0))?
            .collect::<Result<Vec<i64>, _>>()?;
        ids
    };
    let tx = conn.unchecked_transaction()?;
    for (i, id) in ids.iter().enumerate() {
        tx.execute(
            "UPDATE attribute_option SET position = ?1 WHERE id = ?2",
            params![i as i64 + 1, id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

fn not_found(id: i64) -> AppError {
    AppError::new(
        "attribute_not_found",
        format!("Het kenmerk met id {id} bestaat niet (meer)."),
    )
}
fn option_not_found(id: i64) -> AppError {
    AppError::new(
        "option_not_found",
        format!("De optie met id {id} bestaat niet (meer)."),
    )
}
