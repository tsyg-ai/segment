//! Dashboard, Kalender, onboarding & updatecheck. Alles via de
//! publieke `core`-API tegen een in-memory DB.

use rusqlite::params;
use takenbeheer_core::calendar::calendar_events;
use takenbeheer_core::dashboard::{dashboard_snapshot, mark_all_late_seen, mark_reminder_seen};
use takenbeheer_core::models::{
    CreateProjectInput, CreateTodoInput, ReminderDefinition, ReminderMode, ReminderState,
};
use takenbeheer_core::onboarding::onboarding_state;
use takenbeheer_core::settings;
use takenbeheer_core::views::TodoFilter;
use takenbeheer_core::{projects, reminders, statuses, todos, Db};

const NOW: &str = "2026-09-03 09:00:00"; // een donderdag
const LAST_ACTIVE: &str = "2026-09-01 08:00:00";

fn db() -> Db {
    let db = Db::open_in_memory().unwrap();
    db.with_conn(|c| {
        c.execute(
            "UPDATE user_settings SET last_active_at = ?1 WHERE id = 1",
            params![LAST_ACTIVE],
        )?;
        Ok(())
    })
    .unwrap();
    db
}

fn done_status(db: &Db) -> i64 {
    db.with_conn(statuses::list)
        .unwrap()
        .into_iter()
        .find(|s| s.is_done)
        .unwrap()
        .id
}

fn project(db: &Db, name: &str) -> i64 {
    db.with_conn(|c| {
        projects::create_project(
            c,
            CreateProjectInput {
                name: name.into(),
                color: "#7A8F6E".into(),
                template_id: None,
            },
            NOW,
        )
    })
    .unwrap()
    .id
}

fn add_todo(db: &Db, project_id: Option<i64>, title: &str, deadline: Option<&str>) -> i64 {
    db.with_conn(|c| {
        todos::create_todo(
            c,
            CreateTodoInput {
                title: title.into(),
                description: String::new(),
                project_id,
                position: None,
                status_id: None,
                deadline_date: deadline.map(str::to_string),
                deadline_time: None,
            },
            NOW,
        )
    })
    .unwrap()
    .id
}

fn absolute(literal: &str) -> ReminderDefinition {
    ReminderDefinition {
        id: None,
        mode: ReminderMode::Absolute,
        fire_at_literal: Some(literal.to_string()),
        anchor: None,
        basis: None,
        trigger_status_id: None,
        offset_value: None,
        offset_unit: None,
        offset_direction: None,
        fire_time: None,
        fire_at: None,
        fired_at: None,
        fired_late: false,
        seen_at: None,
        state: None,
    }
}

fn add_reminder(db: &Db, todo_id: i64, literal: &str) -> i64 {
    let todo = db
        .with_conn(|c| todos::create_reminder(c, todo_id, absolute(literal), NOW))
        .unwrap();
    todo.reminders.last().unwrap().id.unwrap()
}

fn mark_late(db: &Db, reminder_id: i64) {
    db.with_conn(|c| reminders::set_fired(c, reminder_id, NOW, true))
        .unwrap();
}

fn set_status(db: &Db, todo_id: i64, status_id: i64) {
    db.with_conn(|c| todos::set_todo_status(c, todo_id, status_id, NOW))
        .unwrap();
}

// ======================================================================
// dashboard_snapshot
// ======================================================================

#[test]
fn dashboard_splits_late_from_upcoming_reminders() {
    let db = db();
    let a = add_todo(&db, None, "Oudergesprek voorbereiden", None);
    let late = add_reminder(&db, a, "2026-09-02 09:00:00");
    mark_late(&db, late);

    let b = add_todo(&db, None, "Materiaal klaarleggen", None);
    add_reminder(&db, b, "2026-09-03 16:00:00"); // vandaag, later → pending

    let c = add_todo(&db, None, "Overleg zorgcoördinator", None);
    add_reminder(&db, c, "2026-09-10 08:00:00"); // volgende week → pending

    let snap = db.with_conn(|conn| dashboard_snapshot(conn, NOW)).unwrap();

    assert_eq!(snap.last_active_at.as_deref(), Some(LAST_ACTIVE));
    assert_eq!(snap.late_count, 1);

    // Late bovenaan, dan de twee pending op vuurmoment.
    assert_eq!(snap.reminders.len(), 3);
    assert_eq!(snap.reminders[0].state, ReminderState::Late);
    assert!(snap.reminders[0].was_late);
    assert_eq!(snap.reminders[0].title, "Oudergesprek voorbereiden");
    assert_eq!(snap.reminders[1].state, ReminderState::Pending);
    assert_eq!(snap.reminders[1].title, "Materiaal klaarleggen");
    assert_eq!(snap.reminders[2].title, "Overleg zorgcoördinator");
}

#[test]
fn dashboard_excludes_archived_project_reminders_and_deadlines() {
    let db = db();
    let p = project(&db, "Gearchiveerd project");
    let t = add_todo(&db, Some(p), "Taak in archief", Some("2026-08-20"));
    let r = add_reminder(&db, t, "2026-09-02 09:00:00");
    mark_late(&db, r);
    db.with_conn(|c| projects::archive_project(c, p, NOW))
        .unwrap();

    let snap = db.with_conn(|conn| dashboard_snapshot(conn, NOW)).unwrap();
    assert_eq!(snap.late_count, 0);
    assert!(snap.reminders.is_empty());
    assert!(snap.deadlines.is_empty());
}

#[test]
fn dashboard_orders_missed_deadlines_before_upcoming() {
    let db = db();
    add_todo(&db, None, "Verslag afwerken", Some("2026-08-30")); // gemist
    add_todo(&db, None, "Testbatterij afnemen", Some("2026-09-03")); // vandaag
    add_todo(&db, None, "Adviesgesprek inplannen", Some("2026-09-15")); // later
    let done = add_todo(&db, None, "Al klaar", Some("2026-08-01"));
    set_status(&db, done, done_status(&db)); // afgerond → niet in de lijst

    let snap = db.with_conn(|conn| dashboard_snapshot(conn, NOW)).unwrap();
    let titles: Vec<&str> = snap.deadlines.iter().map(|d| d.title.as_str()).collect();
    assert_eq!(
        titles,
        [
            "Verslag afwerken",
            "Testbatterij afnemen",
            "Adviesgesprek inplannen"
        ]
    );
    assert!(snap.deadlines[0].missed);
    assert!(!snap.deadlines[1].missed);
}

#[test]
fn dashboard_active_projects_carry_progress_and_counts() {
    let db = db();
    let done = done_status(&db);

    let p1 = project(&db, "HGD-traject");
    let a = add_todo(&db, Some(p1), "stap 1", None);
    add_todo(&db, Some(p1), "stap 2", None);
    add_todo(&db, Some(p1), "stap 3", None);
    set_status(&db, a, done); // 1 van 3 klaar

    // Alles klaar → project schuift naar 'completed', valt uit "actief".
    let p2 = project(&db, "Afgerond project");
    let b = add_todo(&db, Some(p2), "enige stap", None);
    set_status(&db, b, done);

    let snap = db.with_conn(|conn| dashboard_snapshot(conn, NOW)).unwrap();
    assert_eq!(snap.active_project_count, 1);
    assert_eq!(snap.project_count, 2); // beide niet-gearchiveerd
    assert_eq!(snap.active_projects.len(), 1);
    assert_eq!(snap.active_projects[0].name, "HGD-traject");
    assert_eq!(snap.active_projects[0].todo_count, 3);
    assert_eq!(snap.active_projects[0].done_count, 1);
}

#[test]
fn dashboard_counts_loose_open_todos() {
    let db = db();
    add_todo(&db, None, "Losse taak 1", None);
    add_todo(&db, None, "Losse taak 2", None);
    let done = add_todo(&db, None, "Losse taak klaar", None);
    set_status(&db, done, done_status(&db));

    let snap = db.with_conn(|conn| dashboard_snapshot(conn, NOW)).unwrap();
    assert_eq!(snap.loose_todo_count, 2);
}

// ======================================================================
// mark_all_late_seen / mark_reminder_seen
// ======================================================================

#[test]
fn mark_all_late_seen_touches_only_now_late_rows() {
    let db = db();
    let a = add_todo(&db, None, "A", None);
    let r1 = add_reminder(&db, a, "2026-09-02 09:00:00");
    let r2 = add_reminder(&db, a, "2026-09-02 10:00:00");
    mark_late(&db, r1);
    mark_late(&db, r2);
    let b = add_todo(&db, None, "B", None);
    add_reminder(&db, b, "2026-09-10 09:00:00"); // pending, niet laat

    let n = db.with_conn(|c| mark_all_late_seen(c, NOW)).unwrap();
    assert_eq!(n, 2);

    let snap = db.with_conn(|conn| dashboard_snapshot(conn, NOW)).unwrap();
    assert_eq!(snap.late_count, 0);
    // De pending blijft in de herinneringensectie staan.
    assert_eq!(snap.reminders.len(), 1);
    assert_eq!(snap.reminders[0].state, ReminderState::Pending);
}

#[test]
fn mark_reminder_seen_touches_only_that_row() {
    let db = db();
    let a = add_todo(&db, None, "A", None);
    let r1 = add_reminder(&db, a, "2026-09-02 09:00:00");
    let r2 = add_reminder(&db, a, "2026-09-02 10:00:00");
    mark_late(&db, r1);
    mark_late(&db, r2);

    db.with_conn(|c| mark_reminder_seen(c, r1, NOW)).unwrap();

    let snap = db.with_conn(|conn| dashboard_snapshot(conn, NOW)).unwrap();
    assert_eq!(snap.late_count, 1);
}

// ======================================================================
// calendar_events
// ======================================================================

#[test]
fn calendar_returns_deadline_and_reminder_events_in_range_only() {
    let db = db();
    let t1 = add_todo(&db, None, "Handelingsplan", Some("2026-09-05"));
    add_reminder(&db, t1, "2026-09-04 09:00:00");
    add_todo(&db, None, "Buiten bereik", Some("2026-10-15"));
    add_reminder(&db, t1, "2026-11-01 09:00:00"); // buiten bereik

    let events = db
        .with_conn(|c| {
            calendar_events(
                c,
                "2026-09-01",
                "2026-09-30",
                &TodoFilter::default(),
                "",
                NOW,
            )
        })
        .unwrap();

    let kinds: Vec<String> = events.iter().map(|e| format!("{:?}", e.kind)).collect();
    assert_eq!(events.len(), 2, "1 deadline + 1 herinnering binnen bereik");
    assert!(kinds.contains(&"Deadline".to_string()));
    assert!(kinds.contains(&"Reminder".to_string()));
    assert!(events.iter().all(|e| e.at.starts_with("2026-09")));
}

#[test]
fn calendar_respects_the_shared_filter() {
    let db = db();
    let p1 = project(&db, "Project A");
    let p2 = project(&db, "Project B");
    add_todo(&db, Some(p1), "Taak A", Some("2026-09-05"));
    add_todo(&db, Some(p2), "Taak B", Some("2026-09-06"));

    let filter = TodoFilter {
        project_ids: vec![p1],
        ..Default::default()
    };
    let events = db
        .with_conn(|c| calendar_events(c, "2026-09-01", "2026-09-30", &filter, "", NOW))
        .unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].title, "Taak A");
}

#[test]
fn calendar_excludes_archived_projects() {
    let db = db();
    let p = project(&db, "Archief");
    add_todo(&db, Some(p), "Verborgen taak", Some("2026-09-05"));
    db.with_conn(|c| projects::archive_project(c, p, NOW))
        .unwrap();

    let events = db
        .with_conn(|c| {
            calendar_events(
                c,
                "2026-09-01",
                "2026-09-30",
                &TodoFilter::default(),
                "",
                NOW,
            )
        })
        .unwrap();
    assert!(events.is_empty());
}

// ======================================================================
// onboarding_state
// ======================================================================

#[test]
fn onboarding_state_tracks_the_three_counts() {
    let db = db();
    let s0 = db.with_conn(onboarding_state).unwrap();
    assert!(!s0.has_template && !s0.has_project && !s0.has_todo);

    db.with_conn(|c| {
        takenbeheer_core::templates::create(c, "HGD", NOW)?;
        Ok(())
    })
    .unwrap();
    let s1 = db.with_conn(onboarding_state).unwrap();
    assert!(s1.has_template && !s1.has_project && !s1.has_todo);

    let p = project(&db, "Dossier 1");
    let s2 = db.with_conn(onboarding_state).unwrap();
    assert!(s2.has_template && s2.has_project && !s2.has_todo);

    add_todo(&db, Some(p), "Taak", None);
    let s3 = db.with_conn(onboarding_state).unwrap();
    assert!(s3.has_template && s3.has_project && s3.has_todo);
}

// ======================================================================
// updatecheck cadans
// ======================================================================

#[test]
fn update_check_is_due_once_per_local_day() {
    assert!(settings::update_check_due(None, NOW));
    assert!(settings::update_check_due(Some("2026-09-02 23:59:00"), NOW));
    assert!(!settings::update_check_due(
        Some("2026-09-03 00:01:00"),
        NOW
    ));
}

#[test]
fn update_check_stamp_is_written_even_on_a_no_op() {
    let db = db();
    assert!(db
        .with_conn(settings::get)
        .unwrap()
        .last_update_check_at
        .is_none());

    db.with_conn(settings::touch_last_update_check).unwrap();

    assert!(db
        .with_conn(settings::get)
        .unwrap()
        .last_update_check_at
        .is_some());
}
