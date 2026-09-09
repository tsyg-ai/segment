//! Meldingen, achtergrondtaak & tray: de core-raakvlakken.
//! `due_pending` / `elapsed_while_closed` als leescriteria, `set_fired` als
//! idempotente dedup-markering, en `touch_last_active` als monotone grens.

use rusqlite::params;
use takenbeheer_core::models::{CreateTodoInput, ReminderDefinition, ReminderMode, ReminderState};
use takenbeheer_core::reminders::{
    due_pending, elapsed_while_closed, notification_target, set_fired,
};
use takenbeheer_core::{settings, todos, Db};

// ======================================================================
// helpers
// ======================================================================

fn db() -> Db {
    Db::open_in_memory().unwrap()
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

fn add_todo(db: &Db, title: &str) -> i64 {
    db.with_conn(|c| {
        todos::create_todo(
            c,
            CreateTodoInput {
                title: title.into(),
                description: String::new(),
                project_id: None,
                position: None,
                status_id: None,
                deadline_date: None,
                deadline_time: None,
            },
            "2026-09-01 09:00:00",
        )
    })
    .unwrap()
    .id
}

fn add_absolute_reminder(db: &Db, todo_id: i64, literal: &str) -> i64 {
    let todo = db
        .with_conn(|c| todos::create_reminder(c, todo_id, absolute(literal), "2026-09-01 09:00:00"))
        .unwrap();
    todo.reminders.last().unwrap().id.unwrap()
}

fn reminder(db: &Db, todo_id: i64) -> ReminderDefinition {
    db.with_conn(|c| todos::get_todo(c, todo_id))
        .unwrap()
        .reminders[0]
        .clone()
}

fn due(db: &Db, now: &str) -> Vec<i64> {
    db.with_conn(|c| due_pending(c, now)).unwrap()
}

fn elapsed(db: &Db, since: &str, now: &str) -> Vec<i64> {
    db.with_conn(|c| elapsed_while_closed(c, since, now))
        .unwrap()
}

fn fire(db: &Db, id: i64, at: &str, late: bool) -> bool {
    db.with_conn(|c| set_fired(c, id, at, late)).unwrap()
}

// ======================================================================
// due_pending — dedup na set_fired
// ======================================================================

#[test]
fn due_pending_drops_a_reminder_once_it_is_fired() {
    let db = db();
    let t = add_todo(&db, "Bel de ouders");
    let rid = add_absolute_reminder(&db, t, "2020-01-01 09:00:00");
    let now = "2026-09-03 09:00:00";

    assert!(due(&db, now).contains(&rid));

    assert!(
        fire(&db, rid, now, false),
        "eerste set_fired zet de markering"
    );

    assert!(
        !due(&db, now).contains(&rid),
        "een gevuurde herinnering komt niet terug in de due-set"
    );
    assert_eq!(reminder(&db, t).state, Some(ReminderState::Fired));
}

#[test]
fn set_fired_is_idempotent_and_never_fires_twice() {
    let db = db();
    let t = add_todo(&db, "Verslag afwerken");
    let rid = add_absolute_reminder(&db, t, "2020-01-01 09:00:00");

    assert!(fire(&db, rid, "2026-09-03 09:00:00", false));
    // Tweede aanroep (andere tijd, andere late-vlag) verandert niets meer.
    assert!(!fire(&db, rid, "2026-09-04 10:00:00", true));

    let r = reminder(&db, t);
    assert_eq!(r.fired_at.as_deref(), Some("2026-09-03 09:00:00"));
    assert!(
        !r.fired_late,
        "de late-markering blijft zoals de eerste keer"
    );
    assert_eq!(r.state, Some(ReminderState::Fired));
}

#[test]
fn set_fired_late_drives_the_late_state() {
    let db = db();
    let t = add_todo(&db, "Intake voorbereiden");
    let rid = add_absolute_reminder(&db, t, "2020-01-01 09:00:00");

    assert!(fire(&db, rid, "2026-09-03 09:00:00", true));
    assert_eq!(reminder(&db, t).state, Some(ReminderState::Late));
}

// ======================================================================
// elapsed_while_closed — begrensd door `since` .. `now`
// ======================================================================

#[test]
fn elapsed_while_closed_is_bounded_by_since_and_now() {
    let db = db();
    let t = add_todo(&db, "Drie herinneringen");
    let before = add_absolute_reminder(&db, t, "2026-08-20 09:00:00"); // vóór `since`
    let inside = add_absolute_reminder(&db, t, "2026-09-02 09:00:00"); // in het venster
    let future = add_absolute_reminder(&db, t, "2099-01-01 09:00:00"); // ná `now`

    let since = "2026-09-01 00:00:00";
    let now = "2026-09-03 00:00:00";

    assert_eq!(elapsed(&db, since, now), vec![inside]);
    assert!(!elapsed(&db, since, now).contains(&before));
    assert!(!elapsed(&db, since, now).contains(&future));

    // Na de inhaalronde (set_fired) valt `inside` uit het venster.
    assert!(fire(&db, inside, now, true));
    assert!(elapsed(&db, since, now).is_empty());
}

#[test]
fn elapsed_while_closed_ignores_fired_seen_and_done() {
    let db = db();
    let t = add_todo(&db, "Al bevestigd");
    let rid = add_absolute_reminder(&db, t, "2026-09-02 09:00:00");
    let since = "2026-09-01 00:00:00";
    let now = "2026-09-03 00:00:00";

    db.with_conn(|c| {
        c.execute(
            "UPDATE reminder
             SET fired_at = '2026-09-02 09:00:01', seen_at = '2026-09-02 10:00:00'
             WHERE id = ?1",
            params![rid],
        )?;
        Ok(())
    })
    .unwrap();

    assert!(elapsed(&db, since, now).is_empty());
}

// ======================================================================
// notification_target
// ======================================================================

#[test]
fn notification_target_returns_the_todo_id_and_title() {
    let db = db();
    let t = add_todo(&db, "Oudercontact plannen");
    let rid = add_absolute_reminder(&db, t, "2026-09-02 09:00:00");

    let target = db.with_conn(|c| notification_target(c, rid)).unwrap();
    assert_eq!(target, Some((t, "Oudercontact plannen".to_string())));

    let missing = db.with_conn(|c| notification_target(c, 9999)).unwrap();
    assert_eq!(missing, None);
}

// ======================================================================
// touch_last_active — monotone grens, ook bij de afsluit-hook
// ======================================================================

#[test]
fn touch_last_active_is_monotonic_and_readable_as_the_boundary() {
    let db = db();
    // De seed legt al een baseline; die is de grens die het opstarten leest.
    let baseline = db.with_conn(settings::get).unwrap().last_active_at;
    assert!(
        baseline.is_some(),
        "de seed zet een last_active_at-baseline"
    );

    db.with_conn(settings::touch_last_active).unwrap();
    let first = db.with_conn(settings::get).unwrap().last_active_at.unwrap();
    assert!(first >= baseline.unwrap());

    db.with_conn(settings::touch_last_active).unwrap();
    let second = db.with_conn(settings::get).unwrap().last_active_at.unwrap();

    // ISO-8601 zonder offset sorteert lexicaal = chronologisch.
    assert!(
        second >= first,
        "de afsluit-hook zet nooit een oudere waarde"
    );
}
