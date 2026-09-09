//! Projecten & Taken. Alles draait tegen een in-memory DB via de
//! publieke `core`-API.

use rusqlite::params;
use takenbeheer_core::models::{
    AttributeInput, AttributeScope, AttributeType, CreateProjectInput, CreateTodoInput,
    ProjectState, ReminderAnchor, ReminderBasis, ReminderDefinition, ReminderDirection,
    ReminderMode, ReminderUnit, TemplateAttributeValue, TodoAttributeValue, TodoTemplateInput,
    UpdateTodoInput,
};
use takenbeheer_core::{attributes, projects, statuses, templates, todos, Db};

const NOW: &str = "2026-09-03 09:00:00";
const LATER: &str = "2026-09-03 12:00:00";

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

fn events_for(db: &Db, todo_id: i64) -> i64 {
    db.with_conn(|c| {
        Ok(c.query_row(
            "SELECT COUNT(*) FROM todo_status_event WHERE todo_id = ?1",
            params![todo_id],
            |r| r.get(0),
        )?)
    })
    .unwrap()
}

/// A sjabloon with two taken; the first carries a text-kenmerkwaarde, a
/// project-scoped kenmerk, één link en one relatieve + één absolute herinnering.
fn template_with_two_tasks(db: &Db) -> (i64, i64, i64, i64) {
    let tpl = db
        .with_conn(|c| templates::create(c, "HGD-traject", NOW))
        .unwrap();
    let global_attr = db
        .with_conn(|c| {
            attributes::create(
                c,
                AttributeInput {
                    name: "Notitie".into(),
                    type_: AttributeType::Text,
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
    let proj_attr = db
        .with_conn(|c| {
            attributes::create(
                c,
                AttributeInput {
                    name: "Fase HGD".into(),
                    type_: AttributeType::Text,
                    scope: AttributeScope::Project,
                    template_id: Some(tpl.id),
                    select_multiple: false,
                    text_multiline: false,
                    number_unit: None,
                    checkbox_default: false,
                },
                NOW,
            )
        })
        .unwrap();

    let t1 = db
        .with_conn(|c| {
            templates::create_todo(
                c,
                tpl.id,
                TodoTemplateInput {
                    title: "Stap 1".into(),
                    description: "x".into(),
                },
            )
        })
        .unwrap();
    let t2 = db
        .with_conn(|c| {
            templates::create_todo(
                c,
                tpl.id,
                TodoTemplateInput {
                    title: "Stap 2".into(),
                    description: String::new(),
                },
            )
        })
        .unwrap();

    db.with_conn(|c| {
        templates::set_todo_attribute_value(
            c,
            t1.id,
            TemplateAttributeValue {
                attribute_id: global_attr.id,
                value_text: Some("Let op".into()),
                value_number: None,
                value_date: None,
                value_bool: None,
                option_ids: vec![],
            },
        )
    })
    .unwrap();
    db.with_conn(|c| {
        templates::set_todo_attribute_value(
            c,
            t1.id,
            TemplateAttributeValue {
                attribute_id: proj_attr.id,
                value_text: Some("Onthaal".into()),
                value_number: None,
                value_date: None,
                value_bool: None,
                option_ids: vec![],
            },
        )
    })
    .unwrap();

    db.with_conn(|c| {
        templates::add_todo_link(c, t1.id, "https://voorbeeld.be/hgd", Some("Draaiboek"))
    })
    .unwrap();

    let def_status = default_status(db);
    db.with_conn(|c| {
        templates::create_todo_reminder(
            c,
            t1.id,
            ReminderDefinition {
                id: None,
                mode: ReminderMode::Relative,
                fire_at_literal: None,
                anchor: Some(ReminderAnchor::ThisTodo),
                basis: Some(ReminderBasis::Status),
                trigger_status_id: Some(def_status),
                offset_value: Some(2),
                offset_unit: Some(ReminderUnit::Days),
                offset_direction: Some(ReminderDirection::After),
                fire_time: Some("09:00".into()),
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
        templates::create_todo_reminder(
            c,
            t2.id,
            ReminderDefinition {
                id: None,
                mode: ReminderMode::Absolute,
                fire_at_literal: Some("2026-10-01 09:00:00".into()),
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

    (tpl.id, global_attr.id, proj_attr.id, t1.id)
}

// ---------------------------------------------------------------- instantiate

#[test]
fn instantiate_from_template_copies_a_full_snapshot() {
    let db = db();
    let (tpl_id, _g, _p, _t1) = template_with_two_tasks(&db);

    let project = db
        .with_conn(|c| {
            projects::create_project(
                c,
                CreateProjectInput {
                    name: "Jan".into(),
                    color: "#7A8F6E".into(),
                    template_id: Some(tpl_id),
                },
                NOW,
            )
        })
        .unwrap();

    let todos = db
        .with_conn(|c| todos::list_todos(c, Some(project.id), false, true))
        .unwrap();
    assert_eq!(todos.len(), 2);
    assert_eq!(
        todos
            .iter()
            .map(|t| t.position.unwrap())
            .collect::<Vec<_>>(),
        [1, 2]
    );

    // geen deadlines
    assert!(todos
        .iter()
        .all(|t| t.deadline_date.is_none() && t.deadline_time.is_none()));
    // elke taak op de standaardstatus
    let def = default_status(&db);
    assert!(todos.iter().all(|t| t.status_id == def));
    // met een todo_status_event voor die startstatus
    for t in &todos {
        assert_eq!(events_for(&db, t.id), 1);
    }
    // links meegekopieerd
    let first = &todos[0];
    assert_eq!(first.links.len(), 1);
    assert_eq!(first.links[0].url, "https://voorbeeld.be/hgd");
    assert_eq!(first.links[0].title.as_deref(), Some("Draaiboek"));
    // kenmerkwaarden meegekopieerd
    assert_eq!(first.attribute_values.len(), 2);
    assert!(first
        .attribute_values
        .iter()
        .any(|v| v.value_text.as_deref() == Some("Onthaal")));
    // herinneringdefinities meegekopieerd, zonder runtime fire_at
    assert_eq!(first.reminders.len(), 1);
    let fire_at: Option<String> = db
        .with_conn(|c| {
            Ok(c.query_row(
                "SELECT fire_at FROM reminder WHERE todo_id = ?1",
                params![first.id],
                |r| r.get(0),
            )?)
        })
        .unwrap();
    assert!(fire_at.is_none());
}

#[test]
fn create_empty_project_has_no_tasks_and_is_active() {
    let db = db();
    let project = db
        .with_conn(|c| {
            projects::create_project(
                c,
                CreateProjectInput {
                    name: "Los project".into(),
                    color: "#6E8296".into(),
                    template_id: None,
                },
                NOW,
            )
        })
        .unwrap();
    assert!(matches!(project.state, ProjectState::Active));
    assert_eq!(project.todo_count, 0);
}

#[test]
fn later_template_edits_do_not_touch_existing_projects() {
    let db = db();
    let (tpl_id, _g, _p, t1) = template_with_two_tasks(&db);
    let project = db
        .with_conn(|c| {
            projects::create_project(
                c,
                CreateProjectInput {
                    name: "Jan".into(),
                    color: "#7A8F6E".into(),
                    template_id: Some(tpl_id),
                },
                NOW,
            )
        })
        .unwrap();

    db.with_conn(|c| {
        templates::update_todo(
            c,
            t1,
            TodoTemplateInput {
                title: "Anders".into(),
                description: String::new(),
            },
        )
    })
    .unwrap();
    db.with_conn(|c| templates::delete_todo(c, t1)).unwrap();

    let todos = db
        .with_conn(|c| todos::list_todos(c, Some(project.id), false, true))
        .unwrap();
    assert_eq!(todos.len(), 2);
    assert_eq!(todos[0].title, "Stap 1");
}

// ---------------------------------------------------------------- derive state

#[test]
fn project_flips_to_completed_and_back() {
    let db = db();
    let (tpl_id, _g, _p, _t1) = template_with_two_tasks(&db);
    let project = db
        .with_conn(|c| {
            projects::create_project(
                c,
                CreateProjectInput {
                    name: "Jan".into(),
                    color: "#7A8F6E".into(),
                    template_id: Some(tpl_id),
                },
                NOW,
            )
        })
        .unwrap();
    let done = done_status(&db);
    let def = default_status(&db);
    let todos = db
        .with_conn(|c| todos::list_todos(c, Some(project.id), false, true))
        .unwrap();

    db.with_conn(|c| todos::set_todo_status(c, todos[0].id, done, NOW))
        .unwrap();
    assert!(matches!(
        db.with_conn(|c| projects::get_project(c, project.id))
            .unwrap()
            .state,
        ProjectState::Active
    ));

    // laatste open taak afgerond → completed, completed_at gezet
    db.with_conn(|c| todos::set_todo_status(c, todos[1].id, done, LATER))
        .unwrap();
    let p = db
        .with_conn(|c| projects::get_project(c, project.id))
        .unwrap();
    assert!(matches!(p.state, ProjectState::Completed));
    assert_eq!(p.completed_at.as_deref(), Some(LATER));

    // een taak verlaat de afgerond-status → terug naar active, completed_at gewist
    db.with_conn(|c| todos::set_todo_status(c, todos[1].id, def, LATER))
        .unwrap();
    let p = db
        .with_conn(|c| projects::get_project(c, project.id))
        .unwrap();
    assert!(matches!(p.state, ProjectState::Active));
    assert!(p.completed_at.is_none());

    // een nieuwe open taak houdt hem active
    db.with_conn(|c| todos::set_todo_status(c, todos[1].id, done, LATER))
        .unwrap();
    db.with_conn(|c| {
        todos::create_todo(
            c,
            CreateTodoInput {
                title: "Extra".into(),
                description: String::new(),
                project_id: Some(project.id),
                position: None,
                status_id: None,
                deadline_date: None,
                deadline_time: None,
            },
            LATER,
        )
    })
    .unwrap();
    assert!(matches!(
        db.with_conn(|c| projects::get_project(c, project.id))
            .unwrap()
            .state,
        ProjectState::Active
    ));
}

// ---------------------------------------------------------------- archive

#[test]
fn archive_hides_from_views_but_stays_searchable_and_unarchive_re_derives() {
    let db = db();
    let (tpl_id, _g, _p, _t1) = template_with_two_tasks(&db);
    let project = db
        .with_conn(|c| {
            projects::create_project(
                c,
                CreateProjectInput {
                    name: "Jan".into(),
                    color: "#7A8F6E".into(),
                    template_id: Some(tpl_id),
                },
                NOW,
            )
        })
        .unwrap();

    db.with_conn(|c| projects::archive_project(c, project.id, LATER))
        .unwrap();
    let p = db
        .with_conn(|c| projects::get_project(c, project.id))
        .unwrap();
    assert!(matches!(p.state, ProjectState::Archived));
    assert_eq!(p.archived_at.as_deref(), Some(LATER));

    // uit de takenview
    let visible = db
        .with_conn(|c| todos::list_todos(c, None, false, false))
        .unwrap();
    assert!(visible.is_empty());
    // maar nog doorzoekbaar (include_archived)
    let all = db
        .with_conn(|c| todos::list_todos(c, None, false, true))
        .unwrap();
    assert_eq!(all.len(), 2);
    // projectenlijst-filter
    assert!(db
        .with_conn(|c| projects::list_projects(c, &[ProjectState::Active]))
        .unwrap()
        .is_empty());
    assert_eq!(
        db.with_conn(|c| projects::list_projects(c, &[ProjectState::Archived]))
            .unwrap()
            .len(),
        1
    );

    // terugzetten → toestand opnieuw afgeleid (active, want open taken)
    db.with_conn(|c| projects::unarchive_project(c, project.id, LATER))
        .unwrap();
    assert!(matches!(
        db.with_conn(|c| projects::get_project(c, project.id))
            .unwrap()
            .state,
        ProjectState::Active
    ));
}

// ---------------------------------------------------------------- duplicate

#[test]
fn duplicate_project_resets_deadlines_status_and_names() {
    let db = db();
    let (tpl_id, _g, _p, _t1) = template_with_two_tasks(&db);
    let project = db
        .with_conn(|c| {
            projects::create_project(
                c,
                CreateProjectInput {
                    name: "Jan".into(),
                    color: "#7A8F6E".into(),
                    template_id: Some(tpl_id),
                },
                NOW,
            )
        })
        .unwrap();
    let todos_before = db
        .with_conn(|c| todos::list_todos(c, Some(project.id), false, true))
        .unwrap();
    let done = done_status(&db);
    db.with_conn(|c| todos::set_todo_status(c, todos_before[0].id, done, NOW))
        .unwrap();
    db.with_conn(|c| {
        todos::set_todo_deadline(
            c,
            todos_before[0].id,
            Some("2026-10-01"),
            Some("09:00"),
            NOW,
        )
    })
    .unwrap();

    let dup = db
        .with_conn(|c| projects::duplicate_project(c, project.id, LATER))
        .unwrap();
    assert_eq!(dup.name, "Jan (kopie)");
    assert!(matches!(dup.state, ProjectState::Active));

    let dup_todos = db
        .with_conn(|c| todos::list_todos(c, Some(dup.id), false, true))
        .unwrap();
    assert_eq!(dup_todos.len(), 2);
    let def = default_status(&db);
    assert!(dup_todos.iter().all(|t| t.status_id == def));
    assert!(dup_todos.iter().all(|t| t.deadline_date.is_none()));
    assert_eq!(
        dup_todos
            .iter()
            .map(|t| t.position.unwrap())
            .collect::<Vec<_>>(),
        [1, 2]
    );
    // kenmerkwaarden en herinneringdefinities mee
    assert_eq!(dup_todos[0].attribute_values.len(), 2);
    assert_eq!(dup_todos[0].reminders.len(), 1);
    // een startstatus-event per gekopieerde taak
    for t in &dup_todos {
        assert_eq!(events_for(&db, t.id), 1);
    }
}

// ---------------------------------------------------------------- duplicate todo

#[test]
fn duplicate_todo_lands_last_without_deadline_on_default_status() {
    let db = db();
    let project = db
        .with_conn(|c| {
            projects::create_project(
                c,
                CreateProjectInput {
                    name: "P".into(),
                    color: "#7A8F6E".into(),
                    template_id: None,
                },
                NOW,
            )
        })
        .unwrap();
    let a = db
        .with_conn(|c| {
            todos::create_todo(
                c,
                CreateTodoInput {
                    title: "Eerste".into(),
                    description: "beschrijving".into(),
                    project_id: Some(project.id),
                    position: None,
                    status_id: None,
                    deadline_date: Some("2026-10-01".into()),
                    deadline_time: None,
                    // deadline via create is allowed but the design says no deadline on
                    // sjabloontaken; here it's a hand-made taak so it's fine.
                },
                NOW,
            )
        })
        .unwrap();
    db.with_conn(|c| todos::add_link(c, a.id, "S:\\map\\bestand.pdf", Some("Dossier")))
        .unwrap();
    let done = done_status(&db);
    db.with_conn(|c| todos::set_todo_status(c, a.id, done, NOW))
        .unwrap();

    let copy = db
        .with_conn(|c| todos::duplicate_todo(c, a.id, LATER))
        .unwrap();
    assert_eq!(copy.title, "Eerste (kopie)");
    assert_eq!(copy.description, "beschrijving");
    assert_eq!(copy.position, Some(2));
    assert!(copy.deadline_date.is_none());
    assert_eq!(copy.status_id, default_status(&db));
    assert_eq!(copy.links.len(), 1);
    assert_eq!(events_for(&db, copy.id), 1);
}

// ---------------------------------------------------------------- move todo

#[test]
fn move_todo_keeps_fields_clears_foreign_template_values_and_appends_last() {
    let db = db();
    let (tpl_a, _g, proj_attr_a, _t1) = template_with_two_tasks(&db);
    let tpl_b = db
        .with_conn(|c| templates::create(c, "Ander traject", NOW))
        .unwrap();

    let pa = db
        .with_conn(|c| {
            projects::create_project(
                c,
                CreateProjectInput {
                    name: "A".into(),
                    color: "#7A8F6E".into(),
                    template_id: Some(tpl_a),
                },
                NOW,
            )
        })
        .unwrap();
    let pb = db
        .with_conn(|c| {
            projects::create_project(
                c,
                CreateProjectInput {
                    name: "B".into(),
                    color: "#6E8296".into(),
                    template_id: Some(tpl_b.id),
                },
                NOW,
            )
        })
        .unwrap();
    db.with_conn(|c| {
        todos::create_todo(
            c,
            CreateTodoInput {
                title: "B-taak".into(),
                description: String::new(),
                project_id: Some(pb.id),
                position: None,
                status_id: None,
                deadline_date: None,
                deadline_time: None,
            },
            NOW,
        )
    })
    .unwrap();

    let a_todos = db
        .with_conn(|c| todos::list_todos(c, Some(pa.id), false, true))
        .unwrap();
    let moving = a_todos[0].id;
    db.with_conn(|c| todos::set_todo_deadline(c, moving, Some("2026-10-01"), Some("09:00"), NOW))
        .unwrap();

    let result = db
        .with_conn(|c| todos::move_todo(c, moving, Some(pb.id), LATER))
        .unwrap();
    // projectkenmerk van sjabloon A → geleegd, gemeld
    assert!(result.cleared_attribute_ids.contains(&proj_attr_a));
    let moved = db.with_conn(|c| todos::get_todo(c, moving)).unwrap();
    assert_eq!(moved.project_id, Some(pb.id));
    assert_eq!(moved.position, Some(2)); // achteraan
                                         // deadline en herinneringen behouden
    assert_eq!(moved.deadline_date.as_deref(), Some("2026-10-01"));
    assert_eq!(moved.reminders.len(), 1);
    // global kenmerkwaarde ("Notitie") blijft
    assert!(moved
        .attribute_values
        .iter()
        .any(|v| v.value_text.as_deref() == Some("Let op")));
    // projectkenmerk-waarde weg
    assert!(!moved
        .attribute_values
        .iter()
        .any(|v| v.attribute_id == proj_attr_a));

    // oude buur schuift aaneengesloten door
    let a_after = db
        .with_conn(|c| todos::list_todos(c, Some(pa.id), false, true))
        .unwrap();
    assert_eq!(
        a_after
            .iter()
            .map(|t| t.position.unwrap())
            .collect::<Vec<_>>(),
        [1]
    );

    // naar losse taak → position NULL
    db.with_conn(|c| todos::move_todo(c, moving, None, LATER))
        .unwrap();
    let loose = db.with_conn(|c| todos::get_todo(c, moving)).unwrap();
    assert_eq!(loose.project_id, None);
    assert_eq!(loose.position, None);
}

// ---------------------------------------------------------------- delete/reorder

#[test]
fn delete_and_reorder_keep_positions_contiguous() {
    let db = db();
    let project = db
        .with_conn(|c| {
            projects::create_project(
                c,
                CreateProjectInput {
                    name: "P".into(),
                    color: "#7A8F6E".into(),
                    template_id: None,
                },
                NOW,
            )
        })
        .unwrap();
    let mk = |title: &str| {
        let title = title.to_string();
        db.with_conn(move |c| {
            todos::create_todo(
                c,
                CreateTodoInput {
                    title: title.clone(),
                    description: String::new(),
                    project_id: Some(project.id),
                    position: None,
                    status_id: None,
                    deadline_date: None,
                    deadline_time: None,
                },
                NOW,
            )
        })
        .unwrap()
    };
    let a = mk("a");
    let b = mk("b");
    let c = mk("c");
    assert_eq!(
        [a.position, b.position, c.position],
        [Some(1), Some(2), Some(3)]
    );

    db.with_conn(|conn| todos::reorder_todos(conn, project.id, &[c.id, a.id, b.id], NOW))
        .unwrap();
    let after = db
        .with_conn(|conn| todos::list_todos(conn, Some(project.id), false, true))
        .unwrap();
    assert_eq!(
        after.iter().map(|t| t.id).collect::<Vec<_>>(),
        [c.id, a.id, b.id]
    );
    assert_eq!(
        after
            .iter()
            .map(|t| t.position.unwrap())
            .collect::<Vec<_>>(),
        [1, 2, 3]
    );

    db.with_conn(|conn| todos::delete_todo(conn, a.id, NOW))
        .unwrap();
    let after = db
        .with_conn(|conn| todos::list_todos(conn, Some(project.id), false, true))
        .unwrap();
    assert_eq!(after.iter().map(|t| t.id).collect::<Vec<_>>(), [c.id, b.id]);
    assert_eq!(
        after
            .iter()
            .map(|t| t.position.unwrap())
            .collect::<Vec<_>>(),
        [1, 2]
    );
}

#[test]
fn insert_at_position_shifts_the_rest() {
    let db = db();
    let project = db
        .with_conn(|c| {
            projects::create_project(
                c,
                CreateProjectInput {
                    name: "P".into(),
                    color: "#7A8F6E".into(),
                    template_id: None,
                },
                NOW,
            )
        })
        .unwrap();
    for title in ["a", "b", "c"] {
        db.with_conn(|c| {
            todos::create_todo(
                c,
                CreateTodoInput {
                    title: title.into(),
                    description: String::new(),
                    project_id: Some(project.id),
                    position: None,
                    status_id: None,
                    deadline_date: None,
                    deadline_time: None,
                },
                NOW,
            )
        })
        .unwrap();
    }
    db.with_conn(|c| {
        todos::create_todo(
            c,
            CreateTodoInput {
                title: "tussen".into(),
                description: String::new(),
                project_id: Some(project.id),
                position: Some(2),
                status_id: None,
                deadline_date: None,
                deadline_time: None,
            },
            NOW,
        )
    })
    .unwrap();
    let after = db
        .with_conn(|c| todos::list_todos(c, Some(project.id), false, true))
        .unwrap();
    assert_eq!(
        after.iter().map(|t| t.title.as_str()).collect::<Vec<_>>(),
        ["a", "tussen", "b", "c"]
    );
    assert_eq!(
        after
            .iter()
            .map(|t| t.position.unwrap())
            .collect::<Vec<_>>(),
        [1, 2, 3, 4]
    );
}

// ---------------------------------------------------------------- mark completed

#[test]
fn mark_project_completed_runs_each_open_task_through_the_normal_path() {
    let db = db();
    let (tpl_id, _g, _p, _t1) = template_with_two_tasks(&db);
    let project = db
        .with_conn(|c| {
            projects::create_project(
                c,
                CreateProjectInput {
                    name: "Jan".into(),
                    color: "#7A8F6E".into(),
                    template_id: Some(tpl_id),
                },
                NOW,
            )
        })
        .unwrap();
    let todos_v = db
        .with_conn(|c| todos::list_todos(c, Some(project.id), false, true))
        .unwrap();

    let p = db
        .with_conn(|c| projects::mark_project_completed(c, project.id, LATER))
        .unwrap();
    assert!(matches!(p.state, ProjectState::Completed));

    let done = done_status(&db);
    let after = db
        .with_conn(|c| todos::list_todos(c, Some(project.id), false, true))
        .unwrap();
    assert!(after.iter().all(|t| t.status_id == done));
    // event per taak: 1 startstatus + 1 afgerond
    for t in &todos_v {
        assert_eq!(events_for(&db, t.id), 2);
    }
}

// ---------------------------------------------------------------- delete project

#[test]
fn delete_project_requires_the_typed_name_and_removes_tasks_but_keeps_template() {
    let db = db();
    let (tpl_id, _g, _p, _t1) = template_with_two_tasks(&db);
    let project = db
        .with_conn(|c| {
            projects::create_project(
                c,
                CreateProjectInput {
                    name: "Jan Peeters".into(),
                    color: "#7A8F6E".into(),
                    template_id: Some(tpl_id),
                },
                NOW,
            )
        })
        .unwrap();
    let todo_ids: Vec<i64> = db
        .with_conn(|c| todos::list_todos(c, Some(project.id), false, true))
        .unwrap()
        .into_iter()
        .map(|t| t.id)
        .collect();

    let err = db
        .with_conn(|c| projects::delete_project(c, project.id, "jan peeters"))
        .unwrap_err();
    assert_eq!(err.code, "project_name_mismatch");
    assert!(db
        .with_conn(|c| projects::get_project(c, project.id))
        .is_ok());

    db.with_conn(|c| projects::delete_project(c, project.id, "Jan Peeters"))
        .unwrap();
    assert!(db
        .with_conn(|c| projects::get_project(c, project.id))
        .is_err());

    // taken + herinneringen weg
    for id in todo_ids {
        assert!(db.with_conn(|c| todos::get_todo(c, id)).is_err());
    }
    let reminder_rows: i64 = db
        .with_conn(|c| Ok(c.query_row("SELECT COUNT(*) FROM reminder", [], |r| r.get(0))?))
        .unwrap();
    assert_eq!(reminder_rows, 0);
    // sjabloon blijft
    assert!(db.with_conn(|c| templates::get(c, tpl_id)).is_ok());
}

// ---------------------------------------------------------------- links & attrs

#[test]
fn links_have_no_validation_and_open_both_paths_and_urls() {
    let db = db();
    let t = db
        .with_conn(|c| {
            todos::create_todo(
                c,
                CreateTodoInput {
                    title: "Los".into(),
                    description: String::new(),
                    project_id: None,
                    position: None,
                    status_id: None,
                    deadline_date: None,
                    deadline_time: None,
                },
                NOW,
            )
        })
        .unwrap();
    db.with_conn(|c| todos::add_link(c, t.id, "https://voorbeeld.be/pad", None))
        .unwrap();
    db.with_conn(|c| todos::add_link(c, t.id, "S:\\gedeeld\\dossier.docx", Some("Dossier")))
        .unwrap();
    let got = db.with_conn(|c| todos::get_todo(c, t.id)).unwrap();
    assert_eq!(got.links.len(), 2);

    let link_id = got.links[0].id;
    db.with_conn(|c| todos::update_link(c, link_id, "http://anders", Some("nieuw")))
        .unwrap();
    db.with_conn(|c| todos::remove_link(c, got.links[1].id))
        .unwrap();
    let got = db.with_conn(|c| todos::get_todo(c, t.id)).unwrap();
    assert_eq!(got.links.len(), 1);
    assert_eq!(got.links[0].title.as_deref(), Some("nieuw"));
}

#[test]
fn set_todo_attribute_value_scalar_select_and_clear() {
    let db = db();
    let attr = db
        .with_conn(|c| {
            attributes::create(
                c,
                AttributeInput {
                    name: "Type".into(),
                    type_: AttributeType::Select,
                    scope: AttributeScope::Global,
                    template_id: None,
                    select_multiple: true,
                    text_multiline: false,
                    number_unit: None,
                    checkbox_default: false,
                },
                NOW,
            )
        })
        .unwrap();
    let o1 = db
        .with_conn(|c| attributes::create_option(c, attr.id, "Gesprek"))
        .unwrap();
    let o2 = db
        .with_conn(|c| attributes::create_option(c, attr.id, "Verslag"))
        .unwrap();
    let t = db
        .with_conn(|c| {
            todos::create_todo(
                c,
                CreateTodoInput {
                    title: "Los".into(),
                    description: String::new(),
                    project_id: None,
                    position: None,
                    status_id: None,
                    deadline_date: None,
                    deadline_time: None,
                },
                NOW,
            )
        })
        .unwrap();

    db.with_conn(|c| {
        todos::set_todo_attribute_value(
            c,
            t.id,
            TodoAttributeValue {
                attribute_id: attr.id,
                value_text: None,
                value_number: None,
                value_date: None,
                value_time: None,
                value_bool: None,
                option_ids: vec![o1.id, o2.id],
                option_labels: vec![],
            },
            NOW,
        )
    })
    .unwrap();
    let got = db.with_conn(|c| todos::get_todo(c, t.id)).unwrap();
    assert_eq!(got.attribute_values[0].option_ids, vec![o1.id, o2.id]);
    assert_eq!(
        got.attribute_values[0].option_labels,
        vec!["Gesprek", "Verslag"]
    );

    // clear
    db.with_conn(|c| {
        todos::set_todo_attribute_value(
            c,
            t.id,
            TodoAttributeValue {
                attribute_id: attr.id,
                value_text: None,
                value_number: None,
                value_date: None,
                value_time: None,
                value_bool: None,
                option_ids: vec![],
                option_labels: vec![],
            },
            NOW,
        )
    })
    .unwrap();
    let got = db.with_conn(|c| todos::get_todo(c, t.id)).unwrap();
    assert!(got.attribute_values.is_empty());
}

#[test]
fn update_todo_patches_title_and_description_only() {
    let db = db();
    let t = db
        .with_conn(|c| {
            todos::create_todo(
                c,
                CreateTodoInput {
                    title: "Oud".into(),
                    description: "oud".into(),
                    project_id: None,
                    position: None,
                    status_id: None,
                    deadline_date: None,
                    deadline_time: None,
                },
                NOW,
            )
        })
        .unwrap();
    let updated = db
        .with_conn(|c| {
            todos::update_todo(
                c,
                t.id,
                UpdateTodoInput {
                    title: Some("Nieuw".into()),
                    description: None,
                },
            )
        })
        .unwrap();
    assert_eq!(updated.title, "Nieuw");
    assert_eq!(updated.description, "oud");

    let err = db
        .with_conn(|c| {
            todos::update_todo(
                c,
                t.id,
                UpdateTodoInput {
                    title: Some("   ".into()),
                    description: None,
                },
            )
        })
        .unwrap_err();
    assert_eq!(err.code, "todo_title_empty");
}

#[test]
fn deadline_without_a_date_is_dropped() {
    let db = db();
    let t = db
        .with_conn(|c| {
            todos::create_todo(
                c,
                CreateTodoInput {
                    title: "x".into(),
                    description: String::new(),
                    project_id: None,
                    position: None,
                    status_id: None,
                    deadline_date: None,
                    deadline_time: None,
                },
                NOW,
            )
        })
        .unwrap();
    let got = db
        .with_conn(|c| todos::set_todo_deadline(c, t.id, None, Some("09:00"), NOW))
        .unwrap();
    assert!(got.deadline_date.is_none() && got.deadline_time.is_none());

    let got = db
        .with_conn(|c| todos::set_todo_deadline(c, t.id, Some("2026-10-01"), None, NOW))
        .unwrap();
    assert_eq!(got.deadline_date.as_deref(), Some("2026-10-01"));
    assert!(got.deadline_time.is_none());
}
