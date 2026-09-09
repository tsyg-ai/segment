//! Herinneringen-engine: `fire_at`-resolutie, toestandsmachine,
//! herberekening (spec §6). De pure kruising staat bovenaan; de DB-integratie
//! (toestanden + recalc) daaronder. Alles via de publieke `core`-API.

use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
use rusqlite::params;
use takenbeheer_core::models::{
    CreateProjectInput, CreateTodoInput, ReminderAnchor, ReminderBasis, ReminderDefinition,
    ReminderDirection, ReminderMode, ReminderState, ReminderUnit,
};
use takenbeheer_core::reminders::{
    derive_state, due_pending, elapsed_while_closed, mark_seen, resolve_fire_at, ResolveCtx,
    StateCtx,
};
use takenbeheer_core::{projects, statuses, todos, Db};

// ======================================================================
// helpers
// ======================================================================

fn dt(s: &str) -> NaiveDateTime {
    NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S").unwrap()
}
fn date(s: &str) -> NaiveDate {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
}
fn time(s: &str) -> NaiveTime {
    NaiveTime::parse_from_str(s, "%H:%M").unwrap()
}

fn rel(
    anchor: ReminderAnchor,
    basis: ReminderBasis,
    value: i64,
    unit: ReminderUnit,
    dir: ReminderDirection,
    fire_time: Option<&str>,
) -> ReminderDefinition {
    ReminderDefinition {
        id: None,
        mode: ReminderMode::Relative,
        fire_at_literal: None,
        anchor: Some(anchor),
        basis: Some(basis),
        trigger_status_id: None,
        offset_value: Some(value),
        offset_unit: Some(unit),
        offset_direction: Some(dir),
        fire_time: fire_time.map(|s| s.to_string()),
        fire_at: None,
        fired_at: None,
        fired_late: false,
        seen_at: None,
        state: None,
    }
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

fn deadline_ctx(d: &str, t: Option<&str>) -> ResolveCtx {
    ResolveCtx {
        anchor_exists: true,
        anchor_deadline: Some((date(d), t.map(time))),
        anchor_status_entered_at: None,
    }
}
fn status_ctx(entered: &str) -> ResolveCtx {
    ResolveCtx {
        anchor_exists: true,
        anchor_deadline: None,
        anchor_status_entered_at: Some(dt(entered)),
    }
}

// ======================================================================
// 1. resolve_fire_at — de volledige kruising (pure, DB-vrij)
// ======================================================================

#[test]
fn absolute_reminder_resolves_to_its_literal() {
    let ctx = ResolveCtx {
        anchor_exists: true,
        ..Default::default()
    };
    assert_eq!(
        resolve_fire_at(&absolute("2026-12-24 18:00:00"), &ctx),
        Some(dt("2026-12-24 18:00:00"))
    );
}

#[test]
fn deadline_day_offset_before_and_after_land_on_fire_time() {
    use ReminderAnchor::ThisTodo;
    use ReminderBasis::Deadline;
    use ReminderDirection::*;
    use ReminderUnit::Days;
    let ctx = deadline_ctx("2026-10-01", Some("14:30"));

    // 1 dag vóór, om 09:00
    assert_eq!(
        resolve_fire_at(
            &rel(ThisTodo, Deadline, 1, Days, Before, Some("09:00")),
            &ctx
        ),
        Some(dt("2026-09-30 09:00:00"))
    );
    // 2 dagen ná, om 08:00 — ongeacht het uur van de deadline
    assert_eq!(
        resolve_fire_at(
            &rel(ThisTodo, Deadline, 2, Days, After, Some("08:00")),
            &ctx
        ),
        Some(dt("2026-10-03 08:00:00"))
    );
    // zonder fire_time valt hij op het uur van het ankermoment (14:30)
    assert_eq!(
        resolve_fire_at(&rel(ThisTodo, Deadline, 2, Days, After, None), &ctx),
        Some(dt("2026-10-03 14:30:00"))
    );
}

#[test]
fn deadline_hour_offset_is_exact_elapsed_time_and_ignores_fire_time() {
    use ReminderAnchor::ThisTodo;
    use ReminderBasis::Deadline;
    use ReminderDirection::*;
    use ReminderUnit::Hours;

    let with_time = deadline_ctx("2026-10-01", Some("14:30"));
    assert_eq!(
        resolve_fire_at(
            &rel(ThisTodo, Deadline, 6, Hours, Before, Some("09:00")),
            &with_time
        ),
        Some(dt("2026-10-01 08:30:00"))
    );
    assert_eq!(
        resolve_fire_at(&rel(ThisTodo, Deadline, 6, Hours, After, None), &with_time),
        Some(dt("2026-10-01 20:30:00"))
    );

    // geen deadline_time → ankermoment is middernacht
    let no_time = deadline_ctx("2026-10-01", None);
    assert_eq!(
        resolve_fire_at(&rel(ThisTodo, Deadline, 6, Hours, Before, None), &no_time),
        Some(dt("2026-09-30 18:00:00"))
    );
}

#[test]
fn status_basis_counts_from_most_recent_entered_at_always_after() {
    use ReminderAnchor::ThisTodo;
    use ReminderBasis::Status;
    use ReminderDirection::*;
    use ReminderUnit::*;
    let ctx = status_ctx("2026-09-10 15:00:00");

    // dag-offset landt op fire_time van de doeldag
    assert_eq!(
        resolve_fire_at(&rel(ThisTodo, Status, 3, Days, After, Some("09:00")), &ctx),
        Some(dt("2026-09-13 09:00:00"))
    );
    // zonder fire_time: het uur van het ankermoment
    assert_eq!(
        resolve_fire_at(&rel(ThisTodo, Status, 3, Days, After, None), &ctx),
        Some(dt("2026-09-13 15:00:00"))
    );
    // uur-offset: exact, fire_time genegeerd
    assert_eq!(
        resolve_fire_at(&rel(ThisTodo, Status, 5, Hours, After, Some("09:00")), &ctx),
        Some(dt("2026-09-10 20:00:00"))
    );
    // "before" bij een status-basis wordt als "after" gerekend (validatie weigert
    // het op de invoer; de engine springt er niet op stuk)
    assert_eq!(
        resolve_fire_at(&rel(ThisTodo, Status, 2, Days, Before, Some("09:00")), &ctx),
        Some(dt("2026-09-12 09:00:00"))
    );
}

#[test]
fn no_anchor_moment_resolves_to_none() {
    use ReminderAnchor::{NextTodo, ThisTodo};
    use ReminderBasis::{Deadline, Status};
    use ReminderDirection::After;
    use ReminderUnit::Days;

    // buur bestaat niet
    let missing = ResolveCtx {
        anchor_exists: false,
        ..Default::default()
    };
    assert_eq!(
        resolve_fire_at(
            &rel(NextTodo, Deadline, 1, Days, After, Some("09:00")),
            &missing
        ),
        None
    );
    // deadline-basis zonder deadline
    let no_deadline = ResolveCtx {
        anchor_exists: true,
        ..Default::default()
    };
    assert_eq!(
        resolve_fire_at(
            &rel(ThisTodo, Deadline, 1, Days, After, Some("09:00")),
            &no_deadline
        ),
        None
    );
    // status-basis zonder bereikt moment
    let no_status = ResolveCtx {
        anchor_exists: true,
        ..Default::default()
    };
    assert_eq!(
        resolve_fire_at(
            &rel(ThisTodo, Status, 1, Days, After, Some("09:00")),
            &no_status
        ),
        None
    );
}

#[test]
fn hour_offset_across_a_dst_boundary_is_exact_and_does_not_panic() {
    use ReminderAnchor::ThisTodo;
    use ReminderBasis::Status;
    use ReminderDirection::After;
    use ReminderUnit::Hours;

    // EU lente-wissel (nacht 29 maart 2026) — naïeve wandkloktijd: exact +3 u.
    let spring = status_ctx("2026-03-29 01:30:00");
    assert_eq!(
        resolve_fire_at(&rel(ThisTodo, Status, 3, Hours, After, None), &spring),
        Some(dt("2026-03-29 04:30:00"))
    );
    // EU herfst-wissel (nacht 25 oktober 2026) — idem.
    let autumn = status_ctx("2026-10-25 02:30:00");
    assert_eq!(
        resolve_fire_at(&rel(ThisTodo, Status, 3, Hours, After, None), &autumn),
        Some(dt("2026-10-25 05:30:00"))
    );
}

// ======================================================================
// 2. derive_state — gerichte rijen (pure)
// ======================================================================

#[test]
fn derive_state_covers_every_row() {
    use ReminderAnchor::{PreviousTodo, ThisTodo};
    use ReminderBasis::{Deadline, Status};
    use ReminderMode::Relative;

    let base = StateCtx {
        task_is_done: false,
        project_archived: false,
        anchor_exists: true,
    };

    // pending — deadline opgelost
    assert_eq!(
        derive_state(
            Relative,
            Some(Deadline),
            Some(ThisTodo),
            Some("2026-10-01 09:00:00"),
            None,
            false,
            None,
            &base
        ),
        ReminderState::Pending
    );
    // waiting — status-basis, geen moment
    assert_eq!(
        derive_state(
            Relative,
            Some(Status),
            Some(ThisTodo),
            None,
            None,
            false,
            None,
            &base
        ),
        ReminderState::Waiting
    );
    // inactive — deadline-basis zonder deadline
    assert_eq!(
        derive_state(
            Relative,
            Some(Deadline),
            Some(ThisTodo),
            None,
            None,
            false,
            None,
            &base
        ),
        ReminderState::Inactive
    );
    // inactive — vereiste buur ontbreekt
    let no_anchor = StateCtx {
        anchor_exists: false,
        ..base
    };
    assert_eq!(
        derive_state(
            Relative,
            Some(Deadline),
            Some(PreviousTodo),
            None,
            None,
            false,
            None,
            &no_anchor
        ),
        ReminderState::Inactive
    );
    // inactive — project gearchiveerd
    let archived = StateCtx {
        project_archived: true,
        ..base
    };
    assert_eq!(
        derive_state(
            Relative,
            Some(Deadline),
            Some(ThisTodo),
            Some("2026-10-01 09:00:00"),
            None,
            false,
            None,
            &archived
        ),
        ReminderState::Inactive
    );
    // fired vs late
    assert_eq!(
        derive_state(
            Relative,
            Some(Deadline),
            Some(ThisTodo),
            Some("x"),
            Some("y"),
            false,
            None,
            &base
        ),
        ReminderState::Fired
    );
    assert_eq!(
        derive_state(
            Relative,
            Some(Deadline),
            Some(ThisTodo),
            Some("x"),
            Some("y"),
            true,
            None,
            &base
        ),
        ReminderState::Late
    );
    // seen wint van fired
    assert_eq!(
        derive_state(
            Relative,
            Some(Deadline),
            Some(ThisTodo),
            Some("x"),
            Some("y"),
            true,
            Some("z"),
            &base
        ),
        ReminderState::Seen
    );
    // done wint van alles
    let done = StateCtx {
        task_is_done: true,
        ..base
    };
    assert_eq!(
        derive_state(
            Relative,
            Some(Status),
            Some(ThisTodo),
            None,
            Some("y"),
            true,
            Some("z"),
            &done
        ),
        ReminderState::Done
    );
}

// ======================================================================
// 3. DB-integratie — toestanden & overgangen
// ======================================================================

fn db() -> Db {
    Db::open_in_memory().unwrap()
}
fn status_id(db: &Db, name: &str) -> i64 {
    db.with_conn(statuses::list)
        .unwrap()
        .into_iter()
        .find(|s| s.name == name)
        .unwrap_or_else(|| panic!("geen status {name}"))
        .id
}
fn project(db: &Db) -> i64 {
    db.with_conn(|c| {
        projects::create_project(
            c,
            CreateProjectInput {
                name: "P".into(),
                color: "#7A8F6E".into(),
                template_id: None,
            },
            "2026-09-01 09:00:00",
        )
    })
    .unwrap()
    .id
}
fn add_todo(
    db: &Db,
    project_id: Option<i64>,
    position: Option<i64>,
    deadline: Option<&str>,
) -> i64 {
    db.with_conn(|c| {
        todos::create_todo(
            c,
            CreateTodoInput {
                title: "t".into(),
                description: String::new(),
                project_id,
                position,
                status_id: None,
                deadline_date: deadline.map(|s| s.to_string()),
                deadline_time: deadline.map(|_| "10:00".to_string()),
            },
            "2026-09-01 09:00:00",
        )
    })
    .unwrap()
    .id
}
fn add_reminder(db: &Db, todo_id: i64, mut def: ReminderDefinition, trigger: Option<i64>) -> i64 {
    def.trigger_status_id = trigger;
    let todo = db
        .with_conn(|c| todos::create_reminder(c, todo_id, def.clone(), "2026-09-01 09:00:00"))
        .unwrap();
    todo.reminders.last().unwrap().id.unwrap()
}
fn view(db: &Db, todo_id: i64) -> (Option<String>, ReminderState) {
    let t = db.with_conn(|c| todos::get_todo(c, todo_id)).unwrap();
    let r = &t.reminders[0];
    (r.fire_at.clone(), r.state.unwrap())
}
fn due(db: &Db, now: &str) -> Vec<i64> {
    db.with_conn(|c| due_pending(c, now)).unwrap()
}
fn elapsed(db: &Db, since: &str, now: &str) -> Vec<i64> {
    db.with_conn(|c| elapsed_while_closed(c, since, now))
        .unwrap()
}

#[test]
fn waiting_to_pending_when_the_anchor_task_reaches_the_trigger_status() {
    let db = db();
    let pid = project(&db);
    let a = add_todo(&db, Some(pid), None, None);
    let bezig = status_id(&db, "Bezig");
    add_reminder(
        &db,
        a,
        rel(
            ReminderAnchor::ThisTodo,
            ReminderBasis::Status,
            1,
            ReminderUnit::Days,
            ReminderDirection::After,
            Some("09:00"),
        ),
        Some(bezig),
    );

    let (fire_at, state) = view(&db, a);
    assert_eq!(state, ReminderState::Waiting);
    assert!(fire_at.is_none());

    db.with_conn(|c| todos::set_todo_status(c, a, bezig, "2026-09-10 15:00:00"))
        .unwrap();
    let (fire_at, state) = view(&db, a);
    assert_eq!(state, ReminderState::Pending);
    assert_eq!(fire_at.as_deref(), Some("2026-09-11 09:00:00"));
}

#[test]
fn inactive_to_pending_when_a_deadline_is_set() {
    let db = db();
    let t = add_todo(&db, None, None, None);
    add_reminder(
        &db,
        t,
        rel(
            ReminderAnchor::ThisTodo,
            ReminderBasis::Deadline,
            1,
            ReminderUnit::Days,
            ReminderDirection::Before,
            Some("08:00"),
        ),
        None,
    );
    assert_eq!(view(&db, t).1, ReminderState::Inactive);

    db.with_conn(|c| {
        todos::set_todo_deadline(
            c,
            t,
            Some("2026-10-01"),
            Some("10:00"),
            "2026-09-01 09:00:00",
        )
    })
    .unwrap();
    let (fire_at, state) = view(&db, t);
    assert_eq!(state, ReminderState::Pending);
    assert_eq!(fire_at.as_deref(), Some("2026-09-30 08:00:00"));
}

#[test]
fn inactive_to_pending_when_the_previous_neighbour_appears_and_back() {
    let db = db();
    let pid = project(&db);
    let t1 = add_todo(&db, Some(pid), None, None);
    add_reminder(
        &db,
        t1,
        rel(
            ReminderAnchor::PreviousTodo,
            ReminderBasis::Deadline,
            1,
            ReminderUnit::Days,
            ReminderDirection::Before,
            Some("09:00"),
        ),
        None,
    );
    assert_eq!(view(&db, t1).1, ReminderState::Inactive);

    // een taak vóór t1 invoegen, mét deadline
    let t0 = add_todo(&db, Some(pid), Some(1), Some("2026-10-05"));
    let (fire_at, state) = view(&db, t1);
    assert_eq!(state, ReminderState::Pending);
    assert_eq!(fire_at.as_deref(), Some("2026-10-04 09:00:00"));

    // buur weer weg → terug naar inactive
    db.with_conn(|c| todos::delete_todo(c, t0, "2026-09-02 09:00:00"))
        .unwrap();
    assert_eq!(view(&db, t1).1, ReminderState::Inactive);
}

#[test]
fn archived_project_forces_inactive_and_unarchive_re_resolves() {
    let db = db();
    let pid = project(&db);
    let t = add_todo(&db, Some(pid), None, Some("2026-10-01"));
    add_reminder(
        &db,
        t,
        rel(
            ReminderAnchor::ThisTodo,
            ReminderBasis::Deadline,
            1,
            ReminderUnit::Days,
            ReminderDirection::Before,
            Some("09:00"),
        ),
        None,
    );
    assert_eq!(view(&db, t).1, ReminderState::Pending);

    db.with_conn(|c| projects::archive_project(c, pid, "2026-09-02 09:00:00"))
        .unwrap();
    assert_eq!(view(&db, t).1, ReminderState::Inactive);

    db.with_conn(|c| projects::unarchive_project(c, pid, "2026-09-02 09:00:00"))
        .unwrap();
    let (fire_at, state) = view(&db, t);
    assert_eq!(state, ReminderState::Pending);
    assert_eq!(fire_at.as_deref(), Some("2026-09-30 09:00:00"));
}

#[test]
fn task_on_done_status_closes_the_reminder_and_leaving_done_reopens_it() {
    let db = db();
    let t = add_todo(&db, None, None, Some("2026-10-01"));
    add_reminder(
        &db,
        t,
        rel(
            ReminderAnchor::ThisTodo,
            ReminderBasis::Deadline,
            1,
            ReminderUnit::Days,
            ReminderDirection::Before,
            Some("09:00"),
        ),
        None,
    );
    let done = status_id(&db, "Klaar");
    let todo_status = status_id(&db, "Te doen");

    db.with_conn(|c| todos::set_todo_status(c, t, done, "2026-09-02 09:00:00"))
        .unwrap();
    assert_eq!(view(&db, t).1, ReminderState::Done);

    db.with_conn(|c| todos::set_todo_status(c, t, todo_status, "2026-09-03 09:00:00"))
        .unwrap();
    assert_eq!(view(&db, t).1, ReminderState::Pending);
}

#[test]
fn pending_to_pending_when_the_deadline_shifts() {
    let db = db();
    let t = add_todo(&db, None, None, Some("2026-10-01"));
    add_reminder(
        &db,
        t,
        rel(
            ReminderAnchor::ThisTodo,
            ReminderBasis::Deadline,
            1,
            ReminderUnit::Days,
            ReminderDirection::Before,
            Some("09:00"),
        ),
        None,
    );
    assert_eq!(view(&db, t).0.as_deref(), Some("2026-09-30 09:00:00"));

    db.with_conn(|c| {
        todos::set_todo_deadline(
            c,
            t,
            Some("2026-11-01"),
            Some("10:00"),
            "2026-09-02 09:00:00",
        )
    })
    .unwrap();
    let (fire_at, state) = view(&db, t);
    assert_eq!(state, ReminderState::Pending);
    assert_eq!(fire_at.as_deref(), Some("2026-10-31 09:00:00"));
}

#[test]
fn status_reset_returns_a_status_reminder_to_waiting_then_pending_again() {
    let db = db();
    let pid = project(&db);
    let a = add_todo(&db, Some(pid), None, None);
    let bezig = status_id(&db, "Bezig");
    let todo_status = status_id(&db, "Te doen");
    add_reminder(
        &db,
        a,
        rel(
            ReminderAnchor::ThisTodo,
            ReminderBasis::Status,
            1,
            ReminderUnit::Days,
            ReminderDirection::After,
            Some("09:00"),
        ),
        Some(bezig),
    );

    db.with_conn(|c| todos::set_todo_status(c, a, bezig, "2026-09-10 15:00:00"))
        .unwrap();
    assert_eq!(view(&db, a).1, ReminderState::Pending);

    // terug naar een status vóór de trigger → waiting, geen fire_at
    db.with_conn(|c| todos::set_todo_status(c, a, todo_status, "2026-09-11 09:00:00"))
        .unwrap();
    let (fire_at, state) = view(&db, a);
    assert_eq!(state, ReminderState::Waiting);
    assert!(fire_at.is_none());

    // opnieuw de trigger bereiken → pending met een nieuw, later fire_at
    db.with_conn(|c| todos::set_todo_status(c, a, bezig, "2026-09-20 15:00:00"))
        .unwrap();
    let (fire_at, state) = view(&db, a);
    assert_eq!(state, ReminderState::Pending);
    assert_eq!(fire_at.as_deref(), Some("2026-09-21 09:00:00"));
}

#[test]
fn reordering_re_resolves_previous_todo_anchors_from_the_new_neighbour() {
    let db = db();
    let pid = project(&db);
    let x = add_todo(&db, Some(pid), None, Some("2026-10-01"));
    let y = add_todo(&db, Some(pid), None, Some("2026-10-10"));
    let z = add_todo(&db, Some(pid), None, None);
    add_reminder(
        &db,
        z,
        rel(
            ReminderAnchor::PreviousTodo,
            ReminderBasis::Deadline,
            1,
            ReminderUnit::Days,
            ReminderDirection::Before,
            Some("09:00"),
        ),
        None,
    );
    // z staat achteraan: vorige = y (deadline 10 okt)
    assert_eq!(view(&db, z).0.as_deref(), Some("2026-10-09 09:00:00"));

    // volgorde X, Z, Y → z's vorige is nu x (deadline 1 okt)
    db.with_conn(|c| todos::reorder_todos(c, pid, &[x, z, y], "2026-09-02 09:00:00"))
        .unwrap();
    assert_eq!(view(&db, z).0.as_deref(), Some("2026-09-30 09:00:00"));

    // z vooraan → geen vorige → inactive
    db.with_conn(|c| todos::reorder_todos(c, pid, &[z, x, y], "2026-09-02 09:00:00"))
        .unwrap();
    assert_eq!(view(&db, z).1, ReminderState::Inactive);
}

#[test]
fn deleting_a_status_moves_status_reminders_and_recalculates_them() {
    let db = db();
    let a = add_todo(&db, None, None, None);
    let wacht = db
        .with_conn(|c| {
            statuses::create(
                c,
                takenbeheer_core::models::StatusInput {
                    name: "Wacht".into(),
                    color: "#4A6B8A".into(),
                },
            )
        })
        .unwrap()
        .id;
    let bezig = status_id(&db, "Bezig");
    add_reminder(
        &db,
        a,
        rel(
            ReminderAnchor::ThisTodo,
            ReminderBasis::Status,
            24,
            ReminderUnit::Hours,
            ReminderDirection::After,
            None,
        ),
        Some(wacht),
    );
    db.with_conn(|c| todos::set_todo_status(c, a, wacht, "2026-09-10 12:00:00"))
        .unwrap();
    assert_eq!(view(&db, a).0.as_deref(), Some("2026-09-11 12:00:00"));

    // Wacht verwijderen, taken (en de herinnering-trigger) naar Bezig
    db.with_conn(|c| statuses::delete(c, wacht, Some(bezig), "2026-09-15 08:00:00"))
        .unwrap();

    let t = db.with_conn(|c| todos::get_todo(c, a)).unwrap();
    assert_eq!(t.reminders[0].trigger_status_id, Some(bezig));
    // herberekend vanaf de nieuwe status-intrede (de hertoewijzing logde een event)
    assert_eq!(t.reminders[0].state, Some(ReminderState::Pending));
    assert_eq!(
        t.reminders[0].fire_at.as_deref(),
        Some("2026-09-16 08:00:00")
    );
}

#[test]
fn fired_at_deduplicates_and_drives_the_fired_state() {
    let db = db();
    let t = add_todo(&db, None, None, None);
    let rid = add_reminder(&db, t, absolute("2020-01-01 09:00:00"), None);

    let now = "2026-09-03 09:00:00";
    assert!(due(&db, now).contains(&rid));
    // `elapsed_while_closed` is begrensd door `since`: het vuurmoment
    // (2020) moet ná `since` liggen om als "gemist terwijl dicht" te tellen.
    assert!(elapsed(&db, "2019-01-01 00:00:00", now).contains(&rid));

    db.with_conn(|c| {
        c.execute(
            "UPDATE reminder SET fired_at = '2020-01-01 09:00:01' WHERE id = ?1",
            params![rid],
        )?;
        Ok(())
    })
    .unwrap();

    assert!(
        !due(&db, now).contains(&rid),
        "een gevuurde herinnering komt niet terug"
    );
    assert_eq!(view(&db, t).1, ReminderState::Fired);
}

#[test]
fn mark_seen_moves_a_fired_reminder_to_seen() {
    let db = db();
    let t = add_todo(&db, None, None, None);
    let rid = add_reminder(&db, t, absolute("2020-01-01 09:00:00"), None);
    db.with_conn(|c| {
        c.execute(
            "UPDATE reminder SET fired_at = '2020-01-02 09:00:00', fired_late = 1 WHERE id = ?1",
            params![rid],
        )?;
        Ok(())
    })
    .unwrap();
    assert_eq!(view(&db, t).1, ReminderState::Late);

    db.with_conn(|c| mark_seen(c, rid, "2026-09-03 10:00:00"))
        .unwrap();
    assert_eq!(view(&db, t).1, ReminderState::Seen);
}

#[test]
fn absolute_reminder_is_pending_from_creation() {
    let db = db();
    let db_ref = &db;
    let t = add_todo(db_ref, None, None, None);
    add_reminder(db_ref, t, absolute("2099-01-01 09:00:00"), None);
    let (fire_at, state) = view(db_ref, t);
    assert_eq!(state, ReminderState::Pending);
    assert_eq!(fire_at.as_deref(), Some("2099-01-01 09:00:00"));
}

#[test]
fn status_basis_with_before_is_rejected_on_a_real_task() {
    let db = db();
    let t = add_todo(&db, None, None, None);
    let bezig = status_id(&db, "Bezig");
    let mut def = rel(
        ReminderAnchor::ThisTodo,
        ReminderBasis::Status,
        1,
        ReminderUnit::Days,
        ReminderDirection::Before,
        Some("09:00"),
    );
    def.trigger_status_id = Some(bezig);
    let err = db
        .with_conn(|c| todos::create_reminder(c, t, def.clone(), "2026-09-01 09:00:00"))
        .unwrap_err();
    assert_eq!(err.code, "reminder_status_before");
}
