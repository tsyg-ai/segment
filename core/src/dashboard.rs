//! Dashboard-snapshot (spec §7).
//!
//! Eén leesfunctie ([`dashboard_snapshot`]) stelt de **late-banner** + de drie
//! blokken samen: herinneringen (`late` én aankomende `pending` — een rij die
//! via de banner op `seen` gezet is valt er vanzelf uit), deadlines (gemist én
//! aankomend) en de actieve projecten met hun voortgangsbreuk. De banner-tekst
//! gebruikt [`crate::settings::UserSettings::last_active_at`].
//!
//! De twee `mark_*`-wrappers zijn dunne doorgeefluiken naar de core-
//! functies zodat de commandolaag niets over de herinneringen-engine hoeft te
//! weten.

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::error::AppResult;
use crate::models::{Project, ProjectState, ReminderState};
use crate::{projects, reminders, settings};

/// Alles wat het dashboard bij het openen van de app toont (spec §7).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardData {
    /// Voor de banner-tekst ("… sinds `<tijdstip>`"). `None` bij de allereerste
    /// start voordat de eerste stempel geschreven is.
    pub last_active_at: Option<String>,
    /// Aantal herinneringen dat nú in toestand `late` staat (de banner).
    pub late_count: i64,
    /// De herinneringensectie: `late` bovenaan, dan de aankomende (`pending`).
    pub reminders: Vec<DashboardReminder>,
    /// De deadlinessectie: gemiste en aankomende deadlines.
    pub deadlines: Vec<DashboardDeadline>,
    /// De projectensectie: projecten in toestand `active` met minstens één taak
    /// die niet op de afgerond-status staat.
    pub active_projects: Vec<Project>,
    /// Teller voor "N van M" in de sectiekop.
    pub active_project_count: i64,
    /// Alle niet-gearchiveerde projecten (de noemer `M`).
    pub project_count: i64,
    /// Losse taken (geen project) die niet afgerond zijn — de voetnoot.
    pub loose_todo_count: i64,
}

/// Eén rij in de herinneringensectie.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardReminder {
    pub reminder_id: i64,
    pub todo_id: i64,
    pub title: String,
    pub project_name: Option<String>,
    /// 1-based positie binnen het project (voor "stap X van Y").
    pub position: Option<i64>,
    pub project_todo_count: i64,
    pub state: ReminderState,
    pub fire_at: Option<String>,
    /// `true` wanneer de rij in toestand `late` staat (rode chip).
    pub was_late: bool,
}

/// Eén rij in de deadlinessectie.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardDeadline {
    pub todo_id: i64,
    pub title: String,
    pub project_name: Option<String>,
    pub position: Option<i64>,
    pub project_todo_count: i64,
    pub status_name: String,
    pub deadline_date: String,
    pub deadline_time: Option<String>,
    /// Deadline ligt vóór vandaag en de taak is nog niet afgerond.
    pub missed: bool,
}

struct ReminderRow {
    reminder_id: i64,
    todo_id: i64,
    title: String,
    project_name: Option<String>,
    project_archived: bool,
    position: Option<i64>,
    project_todo_count: i64,
}

/// Stel de volledige dashboard-snapshot samen (spec §7). `now` is lokale
/// wandkloktijd ("YYYY-MM-DD HH:MM:SS").
pub fn dashboard_snapshot(conn: &Connection, now: &str) -> AppResult<DashboardData> {
    let last_active_at = settings::get(conn)?.last_active_at;
    let today = now.get(0..10).unwrap_or_default();

    // --- Herinneringen ---------------------------------------------------
    // `late` (uit de inhaalronde of gemist terwijl de app aan stond) + de
    // aankomende `pending`. Zodra een rij op `seen` gezet is via de banner,
    // valt ze hier vanzelf uit (spec §7).
    let mut stmt = conn.prepare(
        "SELECT r.id, r.todo_id, t.title, p.name,
                COALESCE(p.state, 'active') = 'archived',
                t.position,
                (SELECT COUNT(*) FROM todo tt WHERE tt.project_id = t.project_id)
         FROM reminder r
         JOIN todo t ON t.id = r.todo_id
         LEFT JOIN project p ON p.id = t.project_id",
    )?;
    let rows: Vec<ReminderRow> = stmt
        .query_map([], |r| {
            Ok(ReminderRow {
                reminder_id: r.get(0)?,
                todo_id: r.get(1)?,
                title: r.get(2)?,
                project_name: r.get(3)?,
                project_archived: r.get::<_, i64>(4)? != 0,
                position: r.get(5)?,
                project_todo_count: r.get(6)?,
            })
        })?
        .collect::<Result<_, _>>()?;

    let mut reminders_out: Vec<(u8, Option<String>, DashboardReminder)> = Vec::new();
    let mut late_count = 0i64;

    for row in rows {
        if row.project_archived {
            continue;
        }
        let (fire_at, state) = reminders::resolved_view(conn, row.reminder_id)?;

        // rank 0 = late, 1 = aankomend (pending)
        let rank = match state {
            ReminderState::Late => {
                late_count += 1;
                0
            }
            ReminderState::Pending => 1,
            _ => continue,
        };

        reminders_out.push((
            rank,
            fire_at.clone(),
            DashboardReminder {
                reminder_id: row.reminder_id,
                todo_id: row.todo_id,
                title: row.title,
                project_name: row.project_name,
                position: row.position,
                project_todo_count: row.project_todo_count,
                state,
                fire_at,
                was_late: rank == 0,
            },
        ));
    }
    reminders_out.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1)));
    let reminders = reminders_out.into_iter().map(|(_, _, r)| r).collect();

    // --- Deadlines -------------------------------------------------------
    let mut stmt = conn.prepare(
        "SELECT t.id, t.title, p.name, t.position,
                (SELECT COUNT(*) FROM todo tt WHERE tt.project_id = t.project_id),
                s.name, t.deadline_date, t.deadline_time
         FROM todo t
         JOIN status s ON s.id = t.status_id
         LEFT JOIN project p ON p.id = t.project_id
         WHERE t.deadline_date IS NOT NULL
           AND s.is_done = 0
           AND COALESCE(p.state, 'active') <> 'archived'",
    )?;
    let mut deadlines: Vec<DashboardDeadline> = stmt
        .query_map([], |r| {
            let deadline_date: String = r.get(6)?;
            Ok(DashboardDeadline {
                todo_id: r.get(0)?,
                title: r.get(1)?,
                project_name: r.get(2)?,
                position: r.get(3)?,
                project_todo_count: r.get(4)?,
                status_name: r.get(5)?,
                missed: deadline_date.as_str() < today,
                deadline_date,
                deadline_time: r.get(7)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    // Gemist eerst (oudste bovenaan), dan aankomend op datum.
    deadlines.sort_by(|a, b| {
        b.missed
            .cmp(&a.missed)
            .then(a.deadline_date.cmp(&b.deadline_date))
            .then(a.deadline_time.cmp(&b.deadline_time))
    });

    // --- Actieve projecten --------------------------------------------
    let active = projects::list_projects(conn, &[ProjectState::Active])?;
    let active_projects: Vec<Project> = active
        .into_iter()
        .filter(|p| p.todo_count - p.done_count >= 1)
        .collect();
    let active_project_count = active_projects.len() as i64;
    let project_count =
        projects::list_projects(conn, &[ProjectState::Active, ProjectState::Completed])?.len()
            as i64;

    let loose_todo_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM todo t JOIN status s ON s.id = t.status_id
         WHERE t.project_id IS NULL AND s.is_done = 0",
        [],
        |r| r.get(0),
    )?;

    Ok(DashboardData {
        last_active_at,
        late_count,
        reminders,
        deadlines,
        active_projects,
        active_project_count,
        project_count,
        loose_todo_count,
    })
}

/// "Markeer als gezien" voor de hele banner — elke nu-late herinnering op
/// `seen` (spec §7). Geeft het aantal geraakte rijen terug.
pub fn mark_all_late_seen(conn: &Connection, now: &str) -> AppResult<usize> {
    reminders::mark_seen_all_late(conn, now)
}

/// "Markeer als gezien" voor één rij (spec §7 — ook per rij).
pub fn mark_reminder_seen(conn: &Connection, reminder_id: i64, now: &str) -> AppResult<()> {
    reminders::mark_seen(conn, reminder_id, now)
}
