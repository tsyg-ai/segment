//! Takenviews & gedeelde filterstatus (spec §8, §8.1, §8.2).
//!
//! Eén queryfunctie ([`list_todos_filtered`]) past de **gedeelde filter** + de
//! **zoekterm** toe voor Lijst, Tabel en Kanban; [`count_visible_and_late`]
//! voedt de gedeelde voetbalk. De `bulk_*`-functies delegeren naar de per-taak-
//! commando's zodat `todo_status_event` + de recalc-hooks
//! meelopen. [`get_view_prefs`]/[`set_view_prefs`] bewaren de **view-lokale**
//! sortering/groepering/kolomconfiguratie in `user_settings.column_config`.
//!
//! Harde scheiding (spec §8.1): **alleen de filter is gedeeld**. Sortering,
//! groepering en kolommen zijn view-lokaal en leven volledig in de frontend +
//! `column_config`; de core kent ze enkel als opaque JSON.

use std::collections::HashSet;

use chrono::{Datelike, Duration, NaiveDate};
use rusqlite::{params, params_from_iter, types::Value as SqlValue, Connection};
use serde::{Deserialize, Serialize};

use crate::error::AppResult;
use crate::models::{AttributeScope, AttributeType, ReminderState, Todo};
use crate::{attributes, settings, todos};

// ========================================================================
// Filtermodel (spec §8.1 — status / deadline / project / kenmerken)
// ========================================================================

/// De deadline-filter: zinvolle presets + een vrij bereik (mockup
/// `_filter-takenlijst`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum DeadlineFilter {
    /// Deadline ligt vóór vandaag.
    Overdue,
    /// Deadline is vandaag.
    Today,
    /// Deadline valt in de lopende week (ma–zo rond vandaag).
    ThisWeek,
    /// Geen deadline ingevuld.
    NoDeadline,
    /// Vrij bereik; beide grenzen optioneel ("YYYY-MM-DD", lokaal).
    Range {
        #[serde(default)]
        from: Option<String>,
        #[serde(default)]
        to: Option<String>,
    },
}

/// Eén kenmerkgroep in de filter. `option_ids` = gekozen keuzelijst-opties;
/// `without_value` = de "Niet ingevuld"-waarde (query-helper
/// [`attributes::todos_without_value`]); `with_value` = de "Ingevuld"-waarde
/// voor tekst/getal/datum-kenmerken; `bool_value` = de gewenste
/// aangevinkt-toestand van een `checkbox`-kenmerk.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttributeFilter {
    pub attribute_id: i64,
    #[serde(default)]
    pub option_ids: Vec<i64>,
    #[serde(default)]
    pub without_value: bool,
    #[serde(default)]
    pub with_value: bool,
    #[serde(default)]
    pub bool_value: Option<bool>,
}

impl AttributeFilter {
    fn is_active(&self) -> bool {
        !self.option_ids.is_empty()
            || self.without_value
            || self.with_value
            || self.bool_value.is_some()
    }
}

/// De gedeelde filter. Leeg = alles zichtbaar (gearchiveerde projecten altijd
/// uitgezonderd bij filteren — spec §2.1).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoFilter {
    #[serde(default)]
    pub status_ids: Vec<i64>,
    #[serde(default)]
    pub project_ids: Vec<i64>,
    #[serde(default)]
    pub deadline: Option<DeadlineFilter>,
    #[serde(default)]
    pub attributes: Vec<AttributeFilter>,
}

impl TodoFilter {
    /// Of er überhaupt iets ingesteld staat (voor de "Filter wissen"-knop).
    pub fn is_empty(&self) -> bool {
        self.status_ids.is_empty()
            && self.project_ids.is_empty()
            && self.deadline.is_none()
            && !self.attributes.iter().any(AttributeFilter::is_active)
    }
}

/// De drie getallen achter de voetbalk (`N van M taken zichtbaar` · `N te laat`).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisibleCount {
    /// Taken die door filter + zoekterm heen komen.
    pub visible: i64,
    /// Alle niet-gearchiveerde taken (de noemer `M`).
    pub total: i64,
    /// Zichtbare taken met minstens één herinnering in toestand `late`.
    pub late: i64,
}

// ========================================================================
// Kolomdefinities voor de Tabel (spec §8 — dynamische kenmerkkolommen)
// ========================================================================

/// Eén dynamische kenmerkkolom voor de Tabel. Bevat net genoeg om te renderen
/// en te sorteren; de zichtbaarheid/volgorde zit view-lokaal in `column_config`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttributeColumn {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub type_: AttributeType,
    pub scope: AttributeScope,
    pub template_id: Option<i64>,
    pub number_unit: Option<String>,
    pub select_multiple: bool,
}

/// De kenmerkkolommen voor de Tabel, in de volgorde van [`attributes::list`]
/// (scope, dan naam).
pub fn list_attribute_columns(conn: &Connection) -> AppResult<Vec<AttributeColumn>> {
    Ok(attributes::list(conn)?
        .into_iter()
        .map(|a| AttributeColumn {
            id: a.id,
            name: a.name,
            type_: a.type_,
            scope: a.scope,
            template_id: a.template_id,
            number_unit: a.number_unit,
            select_multiple: a.select_multiple,
        })
        .collect())
}

// ========================================================================
// De gedeelde query (spec §8.1, §8.2)
// ========================================================================

struct Candidate {
    id: i64,
    project_id: Option<i64>,
    title: String,
    description: String,
    status_id: i64,
    deadline_date: Option<String>,
    archived: bool,
    project_name: String,
}

/// Alle taken die door de gedeelde filter **en** de zoekterm heen komen, in de
/// gebruikelijke volgorde (losse taken achteraan, dan per project op positie).
///
/// * **Filteren** sluit taken uit gearchiveerde projecten uit (spec §2.1).
/// * **Zoeken** (`search` niet leeg) mag gearchiveerde projecten wél opleveren
///   en zoekt op titel, omschrijving en projectnaam (spec §8.2). Een
///   niet-gearchiveerde taak moet dan zowel de filter als de zoekterm halen.
pub fn list_todos_filtered(
    conn: &Connection,
    filter: &TodoFilter,
    search: &str,
    now: &str,
) -> AppResult<Vec<Todo>> {
    let needle = search.trim().to_lowercase();
    let searching = !needle.is_empty();

    let mut stmt = conn.prepare(
        "SELECT t.id, t.project_id, t.title, t.description, t.status_id, t.deadline_date,
                COALESCE(p.state, 'active') AS pstate, COALESCE(p.name, '') AS pname
         FROM todo t
         LEFT JOIN project p ON p.id = t.project_id
         ORDER BY t.project_id IS NULL, t.project_id, t.position, t.id",
    )?;
    let candidates: Vec<Candidate> = stmt
        .query_map([], |r| {
            Ok(Candidate {
                id: r.get(0)?,
                project_id: r.get(1)?,
                title: r.get(2)?,
                description: r.get(3)?,
                status_id: r.get(4)?,
                deadline_date: r.get(5)?,
                archived: r.get::<_, String>(6)? == "archived",
                project_name: r.get(7)?,
            })
        })?
        .collect::<Result<_, _>>()?;

    let attr_allow = attribute_allow_set(conn, &filter.attributes)?;
    let today = now.get(0..10).unwrap_or_default().to_string();
    let week = week_bounds(&today);

    let mut out = Vec::new();
    for c in candidates {
        let passes_filter = !c.archived
            && status_ok(&filter.status_ids, c.status_id)
            && project_ok(&filter.project_ids, c.project_id)
            && deadline_ok(
                filter.deadline.as_ref(),
                c.deadline_date.as_deref(),
                &today,
                week,
            )
            && attr_allow.as_ref().map_or(true, |set| set.contains(&c.id));

        let keep = if searching {
            let hit = c.title.to_lowercase().contains(&needle)
                || c.description.to_lowercase().contains(&needle)
                || c.project_name.to_lowercase().contains(&needle);
            hit && (c.archived || passes_filter)
        } else {
            passes_filter
        };

        if keep {
            out.push(todos::read_todo(conn, c.id)?);
        }
    }
    Ok(out)
}

/// De voetbalk-tellingen voor de zichtbare set (spec §8).
pub fn count_visible_and_late(
    conn: &Connection,
    filter: &TodoFilter,
    search: &str,
    now: &str,
) -> AppResult<VisibleCount> {
    let visible = list_todos_filtered(conn, filter, search, now)?;
    let total: i64 = conn.query_row(
        "SELECT COUNT(*) FROM todo t
         LEFT JOIN project p ON p.id = t.project_id
         WHERE COALESCE(p.state, 'active') <> 'archived'",
        [],
        |r| r.get(0),
    )?;
    let late = visible
        .iter()
        .filter(|t| {
            t.reminders
                .iter()
                .any(|r| r.state == Some(ReminderState::Late))
        })
        .count() as i64;
    Ok(VisibleCount {
        visible: visible.len() as i64,
        total,
        late,
    })
}

// --- filterpredicaten -------------------------------------------------------

fn status_ok(status_ids: &[i64], status_id: i64) -> bool {
    status_ids.is_empty() || status_ids.contains(&status_id)
}

fn project_ok(project_ids: &[i64], project_id: Option<i64>) -> bool {
    if project_ids.is_empty() {
        return true;
    }
    project_id.is_some_and(|p| project_ids.contains(&p))
}

fn deadline_ok(
    filter: Option<&DeadlineFilter>,
    date: Option<&str>,
    today: &str,
    week: (NaiveDate, NaiveDate),
) -> bool {
    let Some(filter) = filter else {
        return true;
    };
    match filter {
        DeadlineFilter::Overdue => date.is_some_and(|d| d < today),
        DeadlineFilter::Today => date == Some(today),
        DeadlineFilter::NoDeadline => date.is_none(),
        DeadlineFilter::ThisWeek => date
            .and_then(parse_date)
            .is_some_and(|d| d >= week.0 && d <= week.1),
        DeadlineFilter::Range { from, to } => {
            let Some(d) = date else { return false };
            from.as_deref().map_or(true, |f| d >= f) && to.as_deref().map_or(true, |t| d <= t)
        }
    }
}

fn parse_date(s: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()
}

/// Maandag–zondag van de week rond `today`. Valt `today` niet te parsen, dan een
/// leeg bereik dat niets matcht.
fn week_bounds(today: &str) -> (NaiveDate, NaiveDate) {
    match parse_date(today) {
        Some(d) => {
            let from_monday = d.weekday().num_days_from_monday() as i64;
            let start = d - Duration::days(from_monday);
            (start, start + Duration::days(6))
        }
        None => {
            let epoch = NaiveDate::from_ymd_opt(1970, 1, 1).unwrap();
            (epoch, epoch)
        }
    }
}

/// De doorsnede van de per-kenmerk toegelaten taak-id-sets, of `None` als er
/// geen kenmerkfilter actief is.
fn attribute_allow_set(
    conn: &Connection,
    filters: &[AttributeFilter],
) -> AppResult<Option<HashSet<i64>>> {
    let mut acc: Option<HashSet<i64>> = None;
    for f in filters.iter().filter(|f| f.is_active()) {
        let mut group: HashSet<i64> = HashSet::new();

        if !f.option_ids.is_empty() {
            let placeholders = vec!["?"; f.option_ids.len()].join(",");
            let sql = format!(
                "SELECT DISTINCT todo_id FROM todo_attribute_value
                 WHERE attribute_id = ? AND option_id IN ({placeholders})"
            );
            let mut args: Vec<SqlValue> = vec![f.attribute_id.into()];
            args.extend(f.option_ids.iter().map(|o| SqlValue::from(*o)));
            let mut stmt = conn.prepare(&sql)?;
            let ids = stmt
                .query_map(params_from_iter(args), |r| r.get::<_, i64>(0))?
                .collect::<Result<Vec<_>, _>>()?;
            group.extend(ids);
        }
        if f.without_value {
            group.extend(attributes::todos_without_value(conn, f.attribute_id)?);
        }
        if f.with_value {
            group.extend(attributes::todos_with_value(conn, f.attribute_id)?);
        }
        if let Some(want) = f.bool_value {
            group.extend(attributes::todos_with_bool_value(
                conn,
                f.attribute_id,
                want,
            )?);
        }

        acc = Some(match acc {
            None => group,
            Some(prev) => prev.intersection(&group).copied().collect(),
        });
    }
    Ok(acc)
}

// ========================================================================
// Bulkmutaties (spec §1.4) — delegeren naar de per-taak-paden
// ========================================================================

/// Controleer dat elke id een bestaande taak is vóór er iets muteert, zodat een
/// batch met een ongeldige id niets aanraakt.
fn ensure_all_todos(conn: &Connection, ids: &[i64]) -> AppResult<()> {
    for &id in ids {
        let exists: bool = conn
            .query_row("SELECT 1 FROM todo WHERE id = ?1", params![id], |_| {
                Ok(true)
            })
            .unwrap_or(false);
        if !exists {
            return Err(crate::error::AppError::new(
                "todo_not_found",
                format!("De taak met id {id} bestaat niet (meer)."),
            ));
        }
    }
    Ok(())
}

/// Bulk-statuswissel: schrijft per taak een `todo_status_event` en trapt de
/// recalc-hooks aan via [`todos::set_todo_status`].
pub fn bulk_set_status(conn: &Connection, ids: &[i64], status_id: i64, now: &str) -> AppResult<()> {
    ensure_all_todos(conn, ids)?;
    for &id in ids {
        todos::set_todo_status(conn, id, status_id, now)?;
    }
    Ok(())
}

/// Bulk-deadline: zet of wist datum (+ optioneel tijdstip) via
/// [`todos::set_todo_deadline`] zodat deadline-gebaseerde herinneringen
/// herberekenen.
pub fn bulk_set_deadline(
    conn: &Connection,
    ids: &[i64],
    date: Option<&str>,
    time: Option<&str>,
    now: &str,
) -> AppResult<()> {
    ensure_all_todos(conn, ids)?;
    for &id in ids {
        todos::set_todo_deadline(conn, id, date, time, now)?;
    }
    Ok(())
}

/// Bulk-verwijderen: via [`todos::delete_todo`] zodat herinneringen mee weg gaan
/// en de posities per project aaneengesloten doorschuiven.
pub fn bulk_delete(conn: &Connection, ids: &[i64], now: &str) -> AppResult<()> {
    ensure_all_todos(conn, ids)?;
    for &id in ids {
        todos::delete_todo(conn, id, now)?;
    }
    Ok(())
}

// ========================================================================
// View-lokale voorkeuren (spec §8.1 — per view persistent in user_settings)
// ========================================================================

/// De opaque voorkeuren-blob voor één view (`"list"` / `"table"` / `"kanban"`),
/// of `null` als er nog niets bewaard is.
pub fn get_view_prefs(conn: &Connection, view: &str) -> AppResult<serde_json::Value> {
    let s = settings::get(conn)?;
    Ok(s.column_config
        .get(view)
        .cloned()
        .unwrap_or(serde_json::Value::Null))
}

/// Bewaar de voorkeuren-blob voor één view. De rest van `column_config` blijft
/// staan.
pub fn set_view_prefs(
    conn: &Connection,
    view: &str,
    prefs: serde_json::Value,
) -> AppResult<serde_json::Value> {
    let mut s = settings::get(conn)?;
    if !s.column_config.is_object() {
        s.column_config = serde_json::Value::Object(Default::default());
    }
    s.column_config
        .as_object_mut()
        .expect("column_config is an object")
        .insert(view.to_string(), prefs.clone());
    settings::set(conn, s)?;
    Ok(prefs)
}
