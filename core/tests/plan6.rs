//! Takenviews & gedeelde filter. Alles via de publieke `core`-API tegen
//! een in-memory DB: de gedeelde query (`list_todos_filtered`), de voetbalk-
//! tellingen (`count_visible_and_late`), de `bulk_*`-delegatie en de view-lokale
//! voorkeuren.

use rusqlite::params;
use takenbeheer_core::models::{
    AttributeInput, AttributeScope, AttributeType, CreateProjectInput, CreateTodoInput,
    TodoAttributeValue,
};
use takenbeheer_core::views::{
    bulk_delete, bulk_set_deadline, bulk_set_status, count_visible_and_late, get_view_prefs,
    list_attribute_columns, list_todos_filtered, set_view_prefs, AttributeFilter, DeadlineFilter,
    TodoFilter,
};
use takenbeheer_core::{attributes, projects, statuses, todos, Db};

const NOW: &str = "2026-09-03 09:00:00"; // een donderdag
const TODAY: &str = "2026-09-03";

fn db() -> Db {
    Db::open_in_memory().unwrap()
}

fn default_status(db: &Db) -> i64 {
    db.with_conn(statuses::list)
        .unwrap()
        .into_iter()
        .find(|s| s.is_default)
        .unwrap()
        .id
}
fn done_status(db: &Db) -> i64 {
    db.with_conn(statuses::list)
        .unwrap()
        .into_iter()
        .find(|s| s.is_done)
        .unwrap()
        .id
}
fn busy_status(db: &Db) -> i64 {
    db.with_conn(statuses::list)
        .unwrap()
        .into_iter()
        .find(|s| !s.is_default && !s.is_done)
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
                deadline_date: deadline.map(|d| d.to_string()),
                deadline_time: None,
            },
            NOW,
        )
    })
    .unwrap()
    .id
}

fn ids(todos: &[takenbeheer_core::Todo]) -> Vec<i64> {
    todos.iter().map(|t| t.id).collect()
}

fn list(db: &Db, filter: &TodoFilter, search: &str) -> Vec<takenbeheer_core::Todo> {
    db.with_conn(|c| list_todos_filtered(c, filter, search, NOW))
        .unwrap()
}

// ======================================================================
// gedeelde query — filterdimensies
// ======================================================================

#[test]
fn empty_filter_lists_every_non_archived_todo() {
    let db = db();
    let p = project(&db, "Jan");
    add_todo(&db, Some(p), "Eerste", None);
    add_todo(&db, Some(p), "Tweede", None);
    add_todo(&db, None, "Losse", None);

    let all = list(&db, &TodoFilter::default(), "");
    assert_eq!(all.len(), 3);
}

#[test]
fn status_filter_keeps_only_the_named_statuses() {
    let db = db();
    let p = project(&db, "Jan");
    let a = add_todo(&db, Some(p), "A", None);
    let b = add_todo(&db, Some(p), "B", None);
    let busy = busy_status(&db);
    db.with_conn(|c| todos::set_todo_status(c, b, busy, NOW))
        .unwrap();

    let filter = TodoFilter {
        status_ids: vec![busy_status(&db)],
        ..Default::default()
    };
    let got = list(&db, &filter, "");
    assert_eq!(ids(&got), vec![b]);

    let filter = TodoFilter {
        status_ids: vec![default_status(&db), busy_status(&db)],
        ..Default::default()
    };
    assert_eq!(list(&db, &filter, "").len(), 2);
    let _ = a;
}

#[test]
fn project_filter_keeps_only_that_project() {
    let db = db();
    let p1 = project(&db, "Jan");
    let p2 = project(&db, "Ada");
    add_todo(&db, Some(p1), "in p1", None);
    add_todo(&db, Some(p2), "in p2", None);
    add_todo(&db, None, "los", None);

    let filter = TodoFilter {
        project_ids: vec![p1],
        ..Default::default()
    };
    let got = list(&db, &filter, "");
    assert_eq!(got.len(), 1);
    assert_eq!(got[0].title, "in p1");
}

#[test]
fn deadline_presets_split_the_set() {
    let db = db();
    let p = project(&db, "Jan");
    let overdue = add_todo(&db, Some(p), "verlopen", Some("2026-08-20"));
    let today = add_todo(&db, Some(p), "vandaag", Some(TODAY));
    let this_week = add_todo(&db, Some(p), "deze week", Some("2026-09-05"));
    let none = add_todo(&db, Some(p), "geen", None);

    let by = |f: DeadlineFilter| {
        ids(&list(
            &db,
            &TodoFilter {
                deadline: Some(f),
                ..Default::default()
            },
            "",
        ))
    };

    assert_eq!(by(DeadlineFilter::Overdue), vec![overdue]);
    assert_eq!(by(DeadlineFilter::Today), vec![today]);
    assert_eq!(by(DeadlineFilter::NoDeadline), vec![none]);

    let week = by(DeadlineFilter::ThisWeek);
    assert!(week.contains(&today) && week.contains(&this_week));
    assert!(!week.contains(&overdue) && !week.contains(&none));

    let range = by(DeadlineFilter::Range {
        from: Some("2026-09-02".into()),
        to: Some("2026-09-04".into()),
    });
    assert_eq!(range, vec![today]);
}

#[test]
fn attribute_option_filter_and_niet_ingevuld() {
    let db = db();
    let attr = db
        .with_conn(|c| {
            attributes::create(
                c,
                AttributeInput {
                    name: "Fase".into(),
                    type_: AttributeType::Select,
                    scope: AttributeScope::Global,
                    template_id: None,
                    select_multiple: false,
                    text_multiline: false,
                    number_unit: None,
                    checkbox_default: false,
                },
                NOW,
            )
        })
        .unwrap()
        .id;
    let opt_a = db
        .with_conn(|c| attributes::create_option(c, attr, "Intake"))
        .unwrap()
        .id;
    let opt_b = db
        .with_conn(|c| attributes::create_option(c, attr, "Afronding"))
        .unwrap()
        .id;

    let p = project(&db, "Jan");
    let with_a = add_todo(&db, Some(p), "met intake", None);
    let with_b = add_todo(&db, Some(p), "met afronding", None);
    let without = add_todo(&db, Some(p), "leeg", None);

    for (todo, opt) in [(with_a, opt_a), (with_b, opt_b)] {
        db.with_conn(|c| {
            todos::set_todo_attribute_value(
                c,
                todo,
                TodoAttributeValue {
                    attribute_id: attr,
                    value_text: None,
                    value_number: None,
                    value_date: None,
                    value_time: None,
                    value_bool: None,
                    option_ids: vec![opt],
                    option_labels: vec![],
                },
                NOW,
            )
        })
        .unwrap();
    }

    // Eén optie
    let by_opt_a = list(
        &db,
        &TodoFilter {
            attributes: vec![AttributeFilter {
                attribute_id: attr,
                option_ids: vec![opt_a],
                without_value: false,
                ..Default::default()
            }],
            ..Default::default()
        },
        "",
    );
    assert_eq!(ids(&by_opt_a), vec![with_a]);

    // Optie OF "Niet ingevuld" binnen dezelfde groep
    let by_a_or_empty = list(
        &db,
        &TodoFilter {
            attributes: vec![AttributeFilter {
                attribute_id: attr,
                option_ids: vec![opt_a],
                without_value: true,
                ..Default::default()
            }],
            ..Default::default()
        },
        "",
    );
    let got = ids(&by_a_or_empty);
    assert!(got.contains(&with_a) && got.contains(&without) && !got.contains(&with_b));
}

fn scalar_attr(db: &Db, name: &str, type_: AttributeType, checkbox_default: bool) -> i64 {
    db.with_conn(|c| {
        attributes::create(
            c,
            AttributeInput {
                name: name.into(),
                type_,
                scope: AttributeScope::Global,
                template_id: None,
                select_multiple: false,
                text_multiline: false,
                number_unit: None,
                checkbox_default,
            },
            NOW,
        )
    })
    .unwrap()
    .id
}

fn set_scalar(db: &Db, todo: i64, value: TodoAttributeValue) {
    db.with_conn(|c| todos::set_todo_attribute_value(c, todo, value, NOW))
        .unwrap();
}

#[test]
fn checkbox_filter_matches_the_effective_aangevinkt_state() {
    let db = db();
    let attr = scalar_attr(&db, "Klaar", AttributeType::Checkbox, false);
    let p = project(&db, "Jan");
    let checked = add_todo(&db, Some(p), "aangevinkt", None);
    let unchecked = add_todo(&db, Some(p), "expliciet uit", None);
    let untouched = add_todo(&db, Some(p), "nooit aangeraakt", None);

    set_scalar(
        &db,
        checked,
        TodoAttributeValue {
            attribute_id: attr,
            value_bool: Some(true),
            ..Default::default()
        },
    );
    set_scalar(
        &db,
        unchecked,
        TodoAttributeValue {
            attribute_id: attr,
            value_bool: Some(false),
            ..Default::default()
        },
    );

    let want_checked = list(
        &db,
        &TodoFilter {
            attributes: vec![AttributeFilter {
                attribute_id: attr,
                bool_value: Some(true),
                ..Default::default()
            }],
            ..Default::default()
        },
        "",
    );
    assert_eq!(ids(&want_checked), vec![checked]);

    // "Niet aangevinkt" telt de expliciete uit-waarde én de taak die de
    // (false) standaard erft.
    let want_unchecked = ids(&list(
        &db,
        &TodoFilter {
            attributes: vec![AttributeFilter {
                attribute_id: attr,
                bool_value: Some(false),
                ..Default::default()
            }],
            ..Default::default()
        },
        "",
    ));
    assert!(want_unchecked.contains(&unchecked) && want_unchecked.contains(&untouched));
    assert!(!want_unchecked.contains(&checked));
}

#[test]
fn text_filter_splits_ingevuld_from_niet_ingevuld() {
    let db = db();
    let attr = scalar_attr(&db, "Notitie", AttributeType::Text, false);
    let p = project(&db, "Jan");
    let filled = add_todo(&db, Some(p), "met tekst", None);
    let blank = add_todo(&db, Some(p), "zonder tekst", None);

    set_scalar(
        &db,
        filled,
        TodoAttributeValue {
            attribute_id: attr,
            value_text: Some("iets".into()),
            ..Default::default()
        },
    );

    let ingevuld = list(
        &db,
        &TodoFilter {
            attributes: vec![AttributeFilter {
                attribute_id: attr,
                with_value: true,
                ..Default::default()
            }],
            ..Default::default()
        },
        "",
    );
    assert_eq!(ids(&ingevuld), vec![filled]);

    let niet = list(
        &db,
        &TodoFilter {
            attributes: vec![AttributeFilter {
                attribute_id: attr,
                without_value: true,
                ..Default::default()
            }],
            ..Default::default()
        },
        "",
    );
    assert_eq!(ids(&niet), vec![blank]);
}

#[test]
fn filter_dimensions_combine_with_and() {
    let db = db();
    let p1 = project(&db, "Jan");
    let p2 = project(&db, "Ada");
    let want = add_todo(&db, Some(p1), "raak", Some(TODAY));
    add_todo(&db, Some(p1), "verkeerde deadline", Some("2026-10-01"));
    add_todo(&db, Some(p2), "verkeerd project", Some(TODAY));

    let filter = TodoFilter {
        project_ids: vec![p1],
        deadline: Some(DeadlineFilter::Today),
        ..Default::default()
    };
    assert_eq!(ids(&list(&db, &filter, "")), vec![want]);
}

// ======================================================================
// gearchiveerd — uitgesloten bij filter, ingesloten bij zoeken (§2.1)
// ======================================================================

#[test]
fn archived_projects_are_hidden_from_filtering_but_findable_by_search() {
    let db = db();
    let live = project(&db, "Levend");
    let gone = project(&db, "Gearchiveerd");
    add_todo(&db, Some(live), "zichtbare taak", None);
    add_todo(&db, Some(gone), "verborgen zoekbaar", None);
    db.with_conn(|c| projects::archive_project(c, gone, NOW))
        .unwrap();

    // Filteren: de gearchiveerde taak valt weg.
    let filtered = list(&db, &TodoFilter::default(), "");
    assert_eq!(filtered.len(), 1);
    assert_eq!(filtered[0].title, "zichtbare taak");

    // Zoeken: de gearchiveerde taak komt wél terug.
    let searched = list(&db, &TodoFilter::default(), "zoekbaar");
    assert_eq!(ids(&searched).len(), 1);
    assert_eq!(searched[0].title, "verborgen zoekbaar");
}

#[test]
fn search_matches_title_description_and_project_name() {
    let db = db();
    let p = project(&db, "Zonnebloem");
    let by_title = add_todo(&db, Some(p), "Intakegesprek plannen", None);
    let by_desc = db
        .with_conn(|c| {
            todos::create_todo(
                c,
                CreateTodoInput {
                    title: "Losse taak".into(),
                    description: "iets met intake erin".into(),
                    project_id: None,
                    position: None,
                    status_id: None,
                    deadline_date: None,
                    deadline_time: None,
                },
                NOW,
            )
        })
        .unwrap()
        .id;
    let by_project = add_todo(&db, Some(p), "Niets bijzonders", None);

    let hits = ids(&list(&db, &TodoFilter::default(), "intake"));
    assert!(hits.contains(&by_title) && hits.contains(&by_desc));

    let hits = ids(&list(&db, &TodoFilter::default(), "zonnebloem"));
    assert!(hits.contains(&by_project) && hits.contains(&by_title));
}

#[test]
fn non_archived_todo_must_match_both_filter_and_search() {
    let db = db();
    let p = project(&db, "Jan");
    add_todo(&db, Some(p), "raak deadline vandaag", Some(TODAY));
    add_todo(&db, Some(p), "raak zonder deadline", None);

    let filter = TodoFilter {
        deadline: Some(DeadlineFilter::Today),
        ..Default::default()
    };
    let got = list(&db, &filter, "raak");
    assert_eq!(got.len(), 1);
    assert_eq!(got[0].title, "raak deadline vandaag");
}

// ======================================================================
// voetbalk — N van M en N te laat
// ======================================================================

#[test]
fn count_visible_and_late_tracks_the_visible_set() {
    let db = db();
    let p = project(&db, "Jan");
    add_todo(&db, Some(p), "vandaag", Some(TODAY));
    add_todo(&db, Some(p), "later", Some("2026-12-01"));
    add_todo(&db, Some(p), "geen deadline", None);

    let all = db
        .with_conn(|c| count_visible_and_late(c, &TodoFilter::default(), "", NOW))
        .unwrap();
    assert_eq!(all.visible, 3);
    assert_eq!(all.total, 3);
    assert_eq!(all.late, 0);

    let filter = TodoFilter {
        deadline: Some(DeadlineFilter::Today),
        ..Default::default()
    };
    let today = db
        .with_conn(|c| count_visible_and_late(c, &filter, "", NOW))
        .unwrap();
    assert_eq!(today.visible, 1);
    assert_eq!(today.total, 3); // de noemer blijft alle niet-gearchiveerde taken
}

#[test]
fn count_late_counts_todos_with_a_late_reminder() {
    let db = db();
    let p = project(&db, "Jan");
    let todo = add_todo(&db, Some(p), "met late herinnering", Some("2026-09-10"));

    // Een absolute herinnering die al gevuurd is via de inhaalronde → `late`.
    db.with_conn(|c| {
        todos::create_reminder(
            c,
            todo,
            takenbeheer_core::models::ReminderDefinition {
                id: None,
                mode: takenbeheer_core::models::ReminderMode::Absolute,
                fire_at_literal: Some("2026-09-02 08:00:00".into()),
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
            },
            NOW,
        )
    })
    .unwrap();
    db.with_conn(|c| {
        Ok(c.execute(
            "UPDATE reminder SET fired_at = ?1, fired_late = 1 WHERE todo_id = ?2",
            params!["2026-09-03 08:05:00", todo],
        )?)
    })
    .unwrap();

    let c = db
        .with_conn(|c| count_visible_and_late(c, &TodoFilter::default(), "", NOW))
        .unwrap();
    assert_eq!(c.late, 1);
}

// ======================================================================
// bulk_* — delegeren naar de per-taak-paden, atomisch bij een foute id
// ======================================================================

#[test]
fn bulk_set_status_writes_an_event_per_todo_and_derives_project_state() {
    let db = db();
    let p = project(&db, "Jan");
    let a = add_todo(&db, Some(p), "A", None);
    let b = add_todo(&db, Some(p), "B", None);
    let done = done_status(&db);

    db.with_conn(|c| bulk_set_status(c, &[a, b], done, NOW))
        .unwrap();

    for todo in [a, b] {
        let events: i64 = db
            .with_conn(|c| {
                Ok(c.query_row(
                    "SELECT COUNT(*) FROM todo_status_event WHERE todo_id = ?1 AND status_id = ?2",
                    params![todo, done],
                    |r| r.get(0),
                )?)
            })
            .unwrap();
        assert_eq!(events, 1, "een statusevent per taak");
    }
    // Alle taken afgerond → projecttoestand kantelt (recalc liep mee).
    let state = db.with_conn(|c| projects::get_project(c, p)).unwrap().state;
    assert_eq!(state, takenbeheer_core::models::ProjectState::Completed);
}

#[test]
fn bulk_set_deadline_updates_every_todo() {
    let db = db();
    let p = project(&db, "Jan");
    let a = add_todo(&db, Some(p), "A", None);
    let b = add_todo(&db, Some(p), "B", None);

    db.with_conn(|c| bulk_set_deadline(c, &[a, b], Some("2026-10-01"), None, NOW))
        .unwrap();

    for todo in [a, b] {
        let d = db
            .with_conn(|c| todos::get_todo(c, todo))
            .unwrap()
            .deadline_date;
        assert_eq!(d.as_deref(), Some("2026-10-01"));
    }
}

#[test]
fn bulk_delete_removes_todos_and_reflows_positions() {
    let db = db();
    let p = project(&db, "Jan");
    let a = add_todo(&db, Some(p), "A", None);
    let b = add_todo(&db, Some(p), "B", None);
    let c_id = add_todo(&db, Some(p), "C", None);

    db.with_conn(|c| bulk_delete(c, &[a, b], NOW)).unwrap();

    let left = db
        .with_conn(|c| todos::list_todos(c, Some(p), false, true))
        .unwrap();
    assert_eq!(ids(&left), vec![c_id]);
    assert_eq!(
        left[0].position,
        Some(1),
        "posities aaneengesloten doorgeschoven"
    );
}

#[test]
fn bulk_op_with_an_unknown_id_changes_nothing() {
    let db = db();
    let p = project(&db, "Jan");
    let a = add_todo(&db, Some(p), "A", None);
    let done = done_status(&db);

    let err = db
        .with_conn(|c| bulk_set_status(c, &[a, 9999], done, NOW))
        .unwrap_err();
    assert_eq!(err.code, "todo_not_found");

    // De geldige taak is niet aangeraakt.
    let still_default = db.with_conn(|c| todos::get_todo(c, a)).unwrap().status_id;
    assert_eq!(still_default, default_status(&db));
    let events: i64 = db
        .with_conn(|c| {
            Ok(c.query_row(
                "SELECT COUNT(*) FROM todo_status_event WHERE todo_id = ?1",
                params![a],
                |r| r.get(0),
            )?)
        })
        .unwrap();
    assert_eq!(events, 1, "alleen het aanmaak-event, geen bulk-event");
}

// ======================================================================
// dynamische kenmerkkolommen + view-lokale voorkeuren
// ======================================================================

#[test]
fn list_attribute_columns_returns_every_kenmerk() {
    let db = db();
    for name in ["Notitie", "Uren"] {
        db.with_conn(|c| {
            attributes::create(
                c,
                AttributeInput {
                    name: name.into(),
                    type_: if name == "Uren" {
                        AttributeType::Number
                    } else {
                        AttributeType::Text
                    },
                    scope: AttributeScope::Global,
                    template_id: None,
                    select_multiple: false,
                    text_multiline: false,
                    number_unit: None,
                    checkbox_default: false,
                },
                NOW,
            )
        })
        .unwrap();
    }
    let cols = db.with_conn(list_attribute_columns).unwrap();
    assert_eq!(cols.len(), 2);
    assert!(cols
        .iter()
        .any(|c| c.name == "Uren" && c.type_ == AttributeType::Number));
}

#[test]
fn view_prefs_round_trip_per_view_and_survive_a_reopen() {
    let db = db();
    assert!(db
        .with_conn(|c| get_view_prefs(c, "table"))
        .unwrap()
        .is_null());

    let table_prefs = serde_json::json!({
        "columns": ["title", "deadline", "status"],
        "hidden": ["created"],
        "sort": { "id": "deadline", "desc": false }
    });
    db.with_conn(|c| set_view_prefs(c, "table", table_prefs.clone()))
        .unwrap();
    db.with_conn(|c| set_view_prefs(c, "kanban", serde_json::json!({ "inColumnSort": "title" })))
        .unwrap();

    // Andere view raakt de eerste niet.
    let back = db.with_conn(|c| get_view_prefs(c, "table")).unwrap();
    assert_eq!(back, table_prefs);
    assert_eq!(
        db.with_conn(|c| get_view_prefs(c, "kanban")).unwrap()["inColumnSort"],
        serde_json::json!("title")
    );

    // "Herstart": zelfde onderliggende settings-rij opnieuw uitlezen.
    let reloaded = db.with_conn(|c| get_view_prefs(c, "table")).unwrap();
    assert_eq!(reloaded["columns"][0], serde_json::json!("title"));
}
