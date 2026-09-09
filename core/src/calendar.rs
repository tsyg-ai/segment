//! Kalender-events (spec §8).
//!
//! [`calendar_events`] levert de **deadline-** én **herinneringsevents** binnen
//! een zichtbaar datumbereik. Het bouwt op [`crate::views::list_todos_filtered`]
//! zodat de **gedeelde filter**, de zoekterm en de uitsluiting van
//! **gearchiveerde projecten** (spec §2.1) automatisch meelopen. De kalender is
//! strikt alleen-lezen — deze functie muteert niets.

use std::collections::HashSet;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::error::AppResult;
use crate::models::ReminderState;
use crate::views::{self, TodoFilter};

/// Deadline- of herinneringsevent.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CalendarKind {
    Deadline,
    Reminder,
}

/// De vier chip-paren uit het ontwerp (te laat / vandaag / neutraal / klaar).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CalendarTone {
    Late,
    Today,
    Neutral,
    Done,
}

/// Eén event in de kalender. `at` is lokale wandkloktijd
/// ("YYYY-MM-DD HH:MM:SS"); `all_day` is `true` voor een deadline zonder
/// tijdstip.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    /// Stabiele id: `"d-<todoId>"` voor een deadline, `"r-<reminderId>"` voor
    /// een herinnering.
    pub id: String,
    pub kind: CalendarKind,
    /// De taak achter het event — een klik opent haar taakdetailpaneel.
    pub todo_id: i64,
    pub title: String,
    pub project_name: Option<String>,
    pub at: String,
    pub all_day: bool,
    pub tone: CalendarTone,
}

/// Alle events met een moment in `[from, to]` (inclusieve datumgrenzen,
/// "YYYY-MM-DD"). `filter` + `search` zijn de gedeelde filter.
pub fn calendar_events(
    conn: &Connection,
    from: &str,
    to: &str,
    filter: &TodoFilter,
    search: &str,
    now: &str,
) -> AppResult<Vec<CalendarEvent>> {
    let todos = views::list_todos_filtered(conn, filter, search, now)?;
    let today = now.get(0..10).unwrap_or_default();

    let done_status_ids: HashSet<i64> = {
        let mut stmt = conn.prepare("SELECT id FROM status WHERE is_done = 1")?;
        let ids: Vec<i64> = stmt
            .query_map([], |r| r.get::<_, i64>(0))?
            .collect::<Result<_, _>>()?;
        ids.into_iter().collect()
    };

    let in_range = |date: &str| date >= from && date <= to;
    let mut out = Vec::new();

    for todo in todos {
        let is_done = done_status_ids.contains(&todo.status_id);

        if let Some(date) = todo.deadline_date.as_deref() {
            if in_range(date) {
                let tone = if is_done {
                    CalendarTone::Done
                } else if date < today {
                    CalendarTone::Late
                } else if date == today {
                    CalendarTone::Today
                } else {
                    CalendarTone::Neutral
                };
                let time = todo.deadline_time.as_deref().unwrap_or("00:00");
                out.push(CalendarEvent {
                    id: format!("d-{}", todo.id),
                    kind: CalendarKind::Deadline,
                    todo_id: todo.id,
                    title: todo.title.clone(),
                    project_name: project_name(conn, todo.project_id)?,
                    at: format!("{date} {time}:00"),
                    all_day: todo.deadline_time.is_none(),
                    tone,
                });
            }
        }

        for rem in &todo.reminders {
            let Some(fire_at) = rem.fire_at.as_deref() else {
                continue;
            };
            let date = fire_at.get(0..10).unwrap_or_default();
            if !in_range(date) {
                continue;
            }
            let visible = matches!(
                rem.state,
                Some(
                    ReminderState::Pending
                        | ReminderState::Fired
                        | ReminderState::Late
                        | ReminderState::Seen
                )
            );
            if !visible {
                continue;
            }
            let tone = match rem.state {
                Some(ReminderState::Late) => CalendarTone::Late,
                Some(ReminderState::Fired | ReminderState::Seen) => CalendarTone::Done,
                _ if date == today => CalendarTone::Today,
                _ => CalendarTone::Neutral,
            };
            out.push(CalendarEvent {
                id: format!("r-{}", rem.id.unwrap_or(0)),
                kind: CalendarKind::Reminder,
                todo_id: todo.id,
                title: todo.title.clone(),
                project_name: project_name(conn, todo.project_id)?,
                at: normalise_dt(fire_at),
                all_day: false,
                tone,
            });
        }
    }

    out.sort_by(|a, b| a.at.cmp(&b.at).then(a.id.cmp(&b.id)));
    Ok(out)
}

fn project_name(conn: &Connection, project_id: Option<i64>) -> AppResult<Option<String>> {
    match project_id {
        None => Ok(None),
        Some(id) => Ok(conn
            .query_row("SELECT name FROM project WHERE id = ?1", [id], |r| r.get(0))
            .ok()),
    }
}

/// Zorg dat een opgeslagen `fire_at` altijd "YYYY-MM-DD HH:MM:SS" is (de engine
/// schrijft al zo weg, maar sjabloonimport / oudere rijen kunnen "HH:MM" zijn).
fn normalise_dt(s: &str) -> String {
    let s = s.trim().replace('T', " ");
    match s.len() {
        16 => format!("{s}:00"),
        _ => s,
    }
}
