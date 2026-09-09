//! Statussen, kenmerken, sjablonen, `append_status_event`.
//! Everything runs against an in-memory DB through the public `core` API.

use rusqlite::params;
use takenbeheer_core::models::{
    AttributeInput, AttributeScope, AttributeType, ReminderAnchor, ReminderBasis,
    ReminderDefinition, ReminderDirection, ReminderMode, ReminderUnit, StatusInput,
    TemplateAttributeValue, TodoTemplateInput,
};
use takenbeheer_core::{attributes, statuses, templates, Db};

const NOW: &str = "2026-09-02 09:00:00";

fn db() -> Db {
    Db::open_in_memory().unwrap()
}

/// Insert a bare todo on `status_id`; returns its id.
fn make_todo(db: &Db, status_id: i64) -> i64 {
    db.with_conn(|c| {
        c.execute(
            "INSERT INTO todo (title, status_id, created_at) VALUES ('t', ?1, ?2)",
            params![status_id, NOW],
        )?;
        Ok(c.last_insert_rowid())
    })
    .unwrap()
}

fn default_status_id(db: &Db) -> i64 {
    db.with_conn(statuses::list)
        .unwrap()
        .into_iter()
        .find(|s| s.is_default)
        .unwrap()
        .id
}
fn done_status_id(db: &Db) -> i64 {
    db.with_conn(statuses::list)
        .unwrap()
        .into_iter()
        .find(|s| s.is_done)
        .unwrap()
        .id
}

// ---------------------------------------------------------------- statuses

#[test]
fn markings_are_seeded_once_and_survive_create_and_rename() {
    let db = db();
    let all = db.with_conn(statuses::list).unwrap();
    assert_eq!(all.iter().filter(|s| s.is_default).count(), 1);
    assert_eq!(all.iter().filter(|s| s.is_done).count(), 1);
    let default_id = all.iter().find(|s| s.is_default).unwrap().id;
    let done_id = all.iter().find(|s| s.is_done).unwrap().id;

    // Creating a status never touches the markings.
    db.with_conn(|c| {
        statuses::create(
            c,
            StatusInput {
                name: "Wacht op derden".into(),
                color: "#4A6B8A".into(),
            },
        )
    })
    .unwrap();

    // The done/default status can only be renamed — the marking stays put.
    db.with_conn(|c| {
        statuses::update(
            c,
            done_id,
            StatusInput {
                name: "Afgehandeld".into(),
                color: "#1F6F66".into(),
            },
        )
    })
    .unwrap();

    let all = db.with_conn(statuses::list).unwrap();
    assert_eq!(all.iter().filter(|s| s.is_default).count(), 1);
    assert_eq!(all.iter().filter(|s| s.is_done).count(), 1);
    assert!(all.iter().find(|s| s.id == default_id).unwrap().is_default);
    let done = all.iter().find(|s| s.id == done_id).unwrap();
    assert!(done.is_done);
    assert_eq!(done.name, "Afgehandeld");
}

#[test]
fn a_marking_can_never_be_emptied() {
    // There is no API that clears a marking without moving it; the done and
    // default statuses also cannot be deleted.
    let db = db();
    let done = done_status_id(&db);
    let err = db
        .with_conn(|c| statuses::delete(c, done, None, NOW))
        .unwrap_err();
    assert_eq!(err.code, "status_is_done");

    let def = default_status_id(&db);
    let err = db
        .with_conn(|c| statuses::delete(c, def, None, NOW))
        .unwrap_err();
    assert_eq!(err.code, "status_is_default");

    // and the markings are still there
    let all = db.with_conn(statuses::list).unwrap();
    assert_eq!(all.iter().filter(|s| s.is_default).count(), 1);
    assert_eq!(all.iter().filter(|s| s.is_done).count(), 1);
}

#[test]
fn create_status_lands_just_before_the_done_status() {
    let db = db();
    let created = db
        .with_conn(|c| {
            statuses::create(
                c,
                StatusInput {
                    name: "Wacht op derden".into(),
                    color: "#4A6B8A".into(),
                },
            )
        })
        .unwrap();
    let all = db.with_conn(statuses::list).unwrap();
    // Te doen(1) Bezig(2) Wacht(3) Klaar(4)
    assert_eq!(all.len(), 4);
    let names: Vec<_> = all.iter().map(|s| s.name.as_str()).collect();
    assert_eq!(names, ["Te doen", "Bezig", "Wacht op derden", "Klaar"]);
    assert_eq!(
        all.iter().map(|s| s.position).collect::<Vec<_>>(),
        [1, 2, 3, 4]
    );
    assert_eq!(created.position, 3);
}

#[test]
fn reorder_statuses_produces_contiguous_positions() {
    let db = db();
    let ids: Vec<i64> = db
        .with_conn(statuses::list)
        .unwrap()
        .iter()
        .map(|s| s.id)
        .collect();
    let reversed: Vec<i64> = ids.iter().rev().copied().collect();
    let after = db.with_conn(|c| statuses::reorder(c, &reversed)).unwrap();
    assert_eq!(
        after.iter().map(|s| s.position).collect::<Vec<_>>(),
        [1, 2, 3]
    );
    assert_eq!(after.iter().map(|s| s.id).collect::<Vec<_>>(), reversed);
}

#[test]
fn delete_status_without_reassign_fails_when_todos_hang_on_it() {
    let db = db();
    let extra = db
        .with_conn(|c| {
            statuses::create(
                c,
                StatusInput {
                    name: "Vervallen".into(),
                    color: "#B9512F".into(),
                },
            )
        })
        .unwrap();
    make_todo(&db, extra.id);

    let err = db
        .with_conn(|c| statuses::delete(c, extra.id, None, NOW))
        .unwrap_err();
    assert_eq!(err.code, "status_reassign_required");
    // still there
    assert!(db
        .with_conn(statuses::list)
        .unwrap()
        .iter()
        .any(|s| s.id == extra.id));
}

#[test]
fn delete_status_with_reassign_moves_todos_reminders_and_logs_events() {
    let db = db();
    let default = default_status_id(&db);
    let extra = db
        .with_conn(|c| {
            statuses::create(
                c,
                StatusInput {
                    name: "Vervallen".into(),
                    color: "#B9512F".into(),
                },
            )
        })
        .unwrap();
    let t1 = make_todo(&db, extra.id);
    let t2 = make_todo(&db, extra.id);

    // a reminder that counts from the doomed status
    db.with_conn(|c| {
        c.execute(
            "INSERT INTO reminder (todo_id, mode, anchor, basis, trigger_status_id,
                 offset_value, offset_unit, offset_direction, created_at)
             VALUES (?1, 'relative', 'this_todo', 'status', ?2, 1, 'days', 'after', ?3)",
            params![t1, extra.id, NOW],
        )?;
        Ok(())
    })
    .unwrap();

    db.with_conn(|c| statuses::delete(c, extra.id, Some(default), NOW))
        .unwrap();

    // status gone
    assert!(!db
        .with_conn(statuses::list)
        .unwrap()
        .iter()
        .any(|s| s.id == extra.id));
    // todos moved
    let moved: Vec<i64> = db
        .with_conn(|c| {
            let mut s = c.prepare("SELECT status_id FROM todo WHERE id IN (?1, ?2)")?;
            let v = s
                .query_map(params![t1, t2], |r| r.get(0))?
                .collect::<Result<Vec<i64>, _>>()?;
            Ok(v)
        })
        .unwrap();
    assert_eq!(moved, [default, default]);
    // reminder pointer rewritten
    let trig: i64 = db
        .with_conn(|c| {
            Ok(c.query_row(
                "SELECT trigger_status_id FROM reminder WHERE todo_id = ?1",
                params![t1],
                |r| r.get(0),
            )?)
        })
        .unwrap();
    assert_eq!(trig, default);
    // one status event per moved todo
    let events: i64 = db
        .with_conn(|c| {
            Ok(c.query_row(
                "SELECT COUNT(*) FROM todo_status_event WHERE status_id = ?1",
                params![default],
                |r| r.get(0),
            )?)
        })
        .unwrap();
    assert_eq!(events, 2);
}

#[test]
fn append_status_event_is_append_only_and_ordered() {
    let db = db();
    let s = default_status_id(&db);
    let done = done_status_id(&db);
    let todo = make_todo(&db, s);

    db.with_conn(|c| statuses::append_status_event(c, todo, s, "2026-09-02 09:00:00"))
        .unwrap();
    db.with_conn(|c| statuses::append_status_event(c, todo, done, "2026-09-02 10:00:00"))
        .unwrap();
    db.with_conn(|c| statuses::append_status_event(c, todo, s, "2026-09-02 11:00:00"))
        .unwrap();

    let rows: Vec<(i64, String)> = db
        .with_conn(|c| {
            let mut st = c.prepare(
                "SELECT status_id, entered_at FROM todo_status_event
                 WHERE todo_id = ?1 ORDER BY entered_at",
            )?;
            let v = st
                .query_map(params![todo], |r| Ok((r.get(0)?, r.get(1)?)))?
                .collect::<Result<Vec<_>, _>>()?;
            Ok(v)
        })
        .unwrap();
    // three rows, two of them on the same status — allowed
    assert_eq!(rows.len(), 3);
    assert_eq!(rows[0].0, s);
    assert_eq!(rows[1].0, done);
    assert_eq!(rows[2].0, s);
    assert!(rows[0].1 < rows[1].1 && rows[1].1 < rows[2].1);
}

// -------------------------------------------------------------- kenmerken

fn global_select(db: &Db, name: &str) -> i64 {
    db.with_conn(|c| {
        attributes::create(
            c,
            AttributeInput {
                name: name.into(),
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
    .id
}

/// Attach an option value to a real todo.
fn set_option_value(db: &Db, todo_id: i64, attribute_id: i64, option_id: i64) {
    db.with_conn(|c| {
        c.execute(
            "INSERT INTO todo_attribute_value (todo_id, attribute_id, option_id) VALUES (?1, ?2, ?3)",
            params![todo_id, attribute_id, option_id],
        )?;
        Ok(())
    })
    .unwrap();
}

#[test]
fn create_global_attribute_is_visible_as_empty_on_every_existing_task() {
    let db = db();
    let s = default_status_id(&db);
    let a = make_todo(&db, s);
    let b = make_todo(&db, s);

    let attr = db
        .with_conn(|c| {
            attributes::create(
                c,
                AttributeInput {
                    name: "Prioriteit".into(),
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

    let without = db
        .with_conn(|c| attributes::todos_without_value(c, attr.id))
        .unwrap();
    assert_eq!(without, vec![a, b]);
}

#[test]
fn rename_option_snapshot_behaviour() {
    let db = db();
    let s = default_status_id(&db);
    let attr = global_select(&db, "Type");
    let opt = db
        .with_conn(|c| attributes::create_option(c, attr, "Gesprek"))
        .unwrap();
    let t = make_todo(&db, s);
    set_option_value(&db, t, attr, opt.id);

    // apply = false -> referencing task keeps the old label as a snapshot
    db.with_conn(|c| attributes::rename_option(c, opt.id, "Gesprek met school", false))
        .unwrap();
    let (oid, snap): (Option<i64>, Option<String>) = db
        .with_conn(|c| {
            Ok(c.query_row(
                "SELECT option_id, option_label_snapshot FROM todo_attribute_value WHERE todo_id = ?1",
                params![t],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )?)
        })
        .unwrap();
    assert_eq!(oid, Some(opt.id));
    assert_eq!(snap.as_deref(), Some("Gesprek"));

    // apply = true -> label changes, snapshot cleared
    db.with_conn(|c| attributes::rename_option(c, opt.id, "Schoolgesprek", true))
        .unwrap();
    let (oid, snap): (Option<i64>, Option<String>) = db
        .with_conn(|c| {
            Ok(c.query_row(
                "SELECT option_id, option_label_snapshot FROM todo_attribute_value WHERE todo_id = ?1",
                params![t],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )?)
        })
        .unwrap();
    assert_eq!(oid, Some(opt.id));
    assert_eq!(snap, None);
    let label: String = db
        .with_conn(|c| {
            Ok(c.query_row(
                "SELECT label FROM attribute_option WHERE id = ?1",
                params![opt.id],
                |r| r.get(0),
            )?)
        })
        .unwrap();
    assert_eq!(label, "Schoolgesprek");
}

#[test]
fn delete_option_snapshot_and_clear_paths() {
    let db = db();
    let s = default_status_id(&db);
    let attr = global_select(&db, "Type");
    let keep = db
        .with_conn(|c| attributes::create_option(c, attr, "Verslag"))
        .unwrap();
    let drop_snap = db
        .with_conn(|c| attributes::create_option(c, attr, "Gesprek"))
        .unwrap();
    let drop_clear = db
        .with_conn(|c| attributes::create_option(c, attr, "Overleg"))
        .unwrap();

    let t1 = make_todo(&db, s);
    let t2 = make_todo(&db, s);
    set_option_value(&db, t1, attr, drop_snap.id);
    set_option_value(&db, t2, attr, drop_clear.id);

    // clear = false -> row stays, option_id NULL, snapshot filled
    db.with_conn(|c| attributes::delete_option(c, drop_snap.id, false))
        .unwrap();
    let (oid, snap): (Option<i64>, Option<String>) = db
        .with_conn(|c| {
            Ok(c.query_row(
                "SELECT option_id, option_label_snapshot FROM todo_attribute_value WHERE todo_id = ?1",
                params![t1],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )?)
        })
        .unwrap();
    assert_eq!(oid, None);
    assert_eq!(snap.as_deref(), Some("Gesprek"));

    // clear = true -> row removed entirely
    db.with_conn(|c| attributes::delete_option(c, drop_clear.id, true))
        .unwrap();
    let rows: i64 = db
        .with_conn(|c| {
            Ok(c.query_row(
                "SELECT COUNT(*) FROM todo_attribute_value WHERE todo_id = ?1",
                params![t2],
                |r| r.get(0),
            )?)
        })
        .unwrap();
    assert_eq!(rows, 0);

    // surviving options renumbered 1..n
    let opts = db.with_conn(|c| attributes::list_options(c, attr)).unwrap();
    assert_eq!(opts.iter().map(|o| o.id).collect::<Vec<_>>(), vec![keep.id]);
    assert_eq!(opts[0].position, 1);
}

#[test]
fn set_attribute_scope_only_narrows_from_project_to_global() {
    let db = db();
    let s = default_status_id(&db);
    let tpl = db
        .with_conn(|c| templates::create(c, "HGD-traject", NOW))
        .unwrap();

    let attr = db
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
    let t = make_todo(&db, s);
    db.with_conn(|c| {
        c.execute(
            "INSERT INTO todo_attribute_value (todo_id, attribute_id, value_text) VALUES (?1, ?2, 'Onthaal')",
            params![t, attr.id],
        )?;
        Ok(())
    })
    .unwrap();

    // project -> global OK, values kept
    let now_global = db
        .with_conn(|c| attributes::set_scope(c, attr.id, AttributeScope::Global))
        .unwrap();
    assert!(matches!(now_global.scope, AttributeScope::Global));
    assert_eq!(now_global.template_id, None);
    let val: String = db
        .with_conn(|c| {
            Ok(c.query_row(
                "SELECT value_text FROM todo_attribute_value WHERE todo_id = ?1",
                params![t],
                |r| r.get(0),
            )?)
        })
        .unwrap();
    assert_eq!(val, "Onthaal");

    // global -> project refused
    let err = db
        .with_conn(|c| attributes::set_scope(c, attr.id, AttributeScope::Project))
        .unwrap_err();
    assert_eq!(err.code, "attribute_scope_narrowing");
}

#[test]
fn delete_attribute_removes_its_task_values() {
    let db = db();
    let s = default_status_id(&db);
    let attr = global_select(&db, "Type");
    let opt = db
        .with_conn(|c| attributes::create_option(c, attr, "Gesprek"))
        .unwrap();
    let t = make_todo(&db, s);
    set_option_value(&db, t, attr, opt.id);

    db.with_conn(|c| attributes::delete(c, attr)).unwrap();
    let rows: i64 = db
        .with_conn(|c| {
            Ok(c.query_row(
                "SELECT COUNT(*) FROM todo_attribute_value WHERE todo_id = ?1",
                params![t],
                |r| r.get(0),
            )?)
        })
        .unwrap();
    assert_eq!(rows, 0);
}

#[test]
fn number_unit_is_trimmed() {
    let db = db();
    let attr = db
        .with_conn(|c| {
            attributes::create(
                c,
                AttributeInput {
                    name: "Tijd".into(),
                    type_: AttributeType::Number,
                    scope: AttributeScope::Global,
                    template_id: None,
                    select_multiple: false,
                    text_multiline: false,
                    number_unit: Some(" u ".into()),
                    checkbox_default: false,
                },
                NOW,
            )
        })
        .unwrap();
    assert_eq!(attr.number_unit.as_deref(), Some("u"));
}

// --------------------------------------------------------------- sjablonen

#[test]
fn template_todo_crud_reorder_and_renumber() {
    let db = db();
    let tpl = db
        .with_conn(|c| templates::create(c, "HGD-traject", NOW))
        .unwrap();
    let mk = |title: &str| {
        let title = title.to_string();
        db.with_conn(move |c| {
            templates::create_todo(
                c,
                tpl.id,
                TodoTemplateInput {
                    title: title.clone(),
                    description: String::new(),
                },
            )
        })
        .unwrap()
    };
    let a = mk("Stap 1");
    let b = mk("Stap 2");
    let c = mk("Stap 3");
    assert_eq!([a.position, b.position, c.position], [1, 2, 3]);

    // reorder c, a, b
    let reordered = db
        .with_conn(|conn| templates::reorder_todos(conn, tpl.id, &[c.id, a.id, b.id]))
        .unwrap();
    assert_eq!(
        reordered.iter().map(|t| t.position).collect::<Vec<_>>(),
        [1, 2, 3]
    );
    assert_eq!(
        reordered.iter().map(|t| t.id).collect::<Vec<_>>(),
        [c.id, a.id, b.id]
    );

    // delete the middle one -> positions stay 1..n
    db.with_conn(|conn| templates::delete_todo(conn, a.id))
        .unwrap();
    let after = db
        .with_conn(|conn| templates::list_todos(conn, tpl.id))
        .unwrap();
    assert_eq!(after.iter().map(|t| t.position).collect::<Vec<_>>(), [1, 2]);
    assert_eq!(after.iter().map(|t| t.id).collect::<Vec<_>>(), [c.id, b.id]);
}

#[test]
fn template_todo_attribute_value_scalar_and_select() {
    let db = db();
    let tpl = db
        .with_conn(|c| templates::create(c, "HGD-traject", NOW))
        .unwrap();
    let tt = db
        .with_conn(|c| {
            templates::create_todo(
                c,
                tpl.id,
                TodoTemplateInput {
                    title: "Stap 1".into(),
                    description: String::new(),
                },
            )
        })
        .unwrap();
    let sel = global_select(&db, "Type");
    let o1 = db
        .with_conn(|c| attributes::create_option(c, sel, "Administratie"))
        .unwrap();
    let o2 = db
        .with_conn(|c| attributes::create_option(c, sel, "Gesprek"))
        .unwrap();

    // multi-select value
    db.with_conn(|c| {
        templates::set_todo_attribute_value(
            c,
            tt.id,
            TemplateAttributeValue {
                attribute_id: sel,
                value_text: None,
                value_number: None,
                value_date: None,
                value_bool: None,
                option_ids: vec![o1.id, o2.id],
            },
        )
    })
    .unwrap();
    let todos = db.with_conn(|c| templates::list_todos(c, tpl.id)).unwrap();
    let v = &todos[0].attribute_values[0];
    assert_eq!(v.option_ids, vec![o1.id, o2.id]);

    // replace with a single option
    db.with_conn(|c| {
        templates::set_todo_attribute_value(
            c,
            tt.id,
            TemplateAttributeValue {
                attribute_id: sel,
                value_text: None,
                value_number: None,
                value_date: None,
                value_bool: None,
                option_ids: vec![o2.id],
            },
        )
    })
    .unwrap();
    let todos = db.with_conn(|c| templates::list_todos(c, tpl.id)).unwrap();
    assert_eq!(todos[0].attribute_values[0].option_ids, vec![o2.id]);

    // clear it
    db.with_conn(|c| {
        templates::set_todo_attribute_value(
            c,
            tt.id,
            TemplateAttributeValue {
                attribute_id: sel,
                value_text: None,
                value_number: None,
                value_date: None,
                value_bool: None,
                option_ids: vec![],
            },
        )
    })
    .unwrap();
    let todos = db.with_conn(|c| templates::list_todos(c, tpl.id)).unwrap();
    assert!(todos[0].attribute_values.is_empty());
}

#[test]
fn template_todo_link_crud() {
    let db = db();
    let tpl = db
        .with_conn(|c| templates::create(c, "HGD-traject", NOW))
        .unwrap();
    let tt = db
        .with_conn(|c| {
            templates::create_todo(
                c,
                tpl.id,
                TodoTemplateInput {
                    title: "Stap 1".into(),
                    description: String::new(),
                },
            )
        })
        .unwrap();

    // add — url + optional title, no validation
    db.with_conn(|c| templates::add_todo_link(c, tt.id, "https://voorbeeld.be", None))
        .unwrap();
    let links = db
        .with_conn(|c| templates::add_todo_link(c, tt.id, "S:\\map\\bestand.pdf", Some("Dossier")))
        .unwrap();
    assert_eq!(links.len(), 2);

    let todos = db.with_conn(|c| templates::list_todos(c, tpl.id)).unwrap();
    assert_eq!(todos[0].links.len(), 2);
    let first_id = todos[0].links[0].id;

    // update
    let links = db
        .with_conn(|c| {
            templates::update_todo_link(c, first_id, "mailto:info@voorbeeld.be", Some("Mail"))
        })
        .unwrap();
    assert_eq!(links[0].url, "mailto:info@voorbeeld.be");
    assert_eq!(links[0].title.as_deref(), Some("Mail"));

    // empty url rejected
    assert!(db
        .with_conn(|c| templates::update_todo_link(c, first_id, "  ", None))
        .is_err());

    // delete
    db.with_conn(|c| templates::delete_todo_link(c, first_id))
        .unwrap();
    let todos = db.with_conn(|c| templates::list_todos(c, tpl.id)).unwrap();
    assert_eq!(todos[0].links.len(), 1);
    assert_eq!(todos[0].links[0].title.as_deref(), Some("Dossier"));

    // deleting the sjabloontaak cascades its links
    db.with_conn(|c| templates::delete_todo(c, tt.id)).unwrap();
    let rows: i64 = db
        .with_conn(
            |c| Ok(c.query_row("SELECT COUNT(*) FROM todo_template_link", [], |r| r.get(0))?),
        )
        .unwrap();
    assert_eq!(rows, 0);
}

#[test]
fn template_reminder_absolute_keeps_literal_relative_stores_definition() {
    let db = db();
    let tpl = db
        .with_conn(|c| templates::create(c, "HGD-traject", NOW))
        .unwrap();
    let tt = db
        .with_conn(|c| {
            templates::create_todo(
                c,
                tpl.id,
                TodoTemplateInput {
                    title: "Stap 1".into(),
                    description: String::new(),
                },
            )
        })
        .unwrap();

    let abs = db
        .with_conn(|c| {
            templates::create_todo_reminder(
                c,
                tt.id,
                ReminderDefinition {
                    id: None,
                    mode: ReminderMode::Absolute,
                    fire_at_literal: Some("2026-09-03 09:00:00".into()),
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
    assert_eq!(abs.fire_at_literal.as_deref(), Some("2026-09-03 09:00:00"));

    let rel = db
        .with_conn(|c| {
            templates::create_todo_reminder(
                c,
                tt.id,
                ReminderDefinition {
                    id: None,
                    mode: ReminderMode::Relative,
                    fire_at_literal: None,
                    anchor: Some(ReminderAnchor::ThisTodo),
                    basis: Some(ReminderBasis::Deadline),
                    trigger_status_id: None,
                    offset_value: Some(1),
                    offset_unit: Some(ReminderUnit::Days),
                    offset_direction: Some(ReminderDirection::Before),
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
    assert!(rel.fire_at_literal.is_none());
    assert_eq!(rel.offset_value, Some(1));
    assert!(matches!(rel.anchor, Some(ReminderAnchor::ThisTodo)));

    // "vóór" + status basis is rejected
    let some_status = default_status_id(&db);
    let err = db
        .with_conn(|c| {
            templates::create_todo_reminder(
                c,
                tt.id,
                ReminderDefinition {
                    id: None,
                    mode: ReminderMode::Relative,
                    fire_at_literal: None,
                    anchor: Some(ReminderAnchor::ThisTodo),
                    basis: Some(ReminderBasis::Status),
                    trigger_status_id: Some(some_status),
                    offset_value: Some(1),
                    offset_unit: Some(ReminderUnit::Days),
                    offset_direction: Some(ReminderDirection::Before),
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
        .unwrap_err();
    assert_eq!(err.code, "reminder_status_before");

    let list = db.with_conn(|c| templates::list_todos(c, tpl.id)).unwrap();
    assert_eq!(list[0].reminders.len(), 2);
}

#[test]
fn template_changes_do_not_touch_existing_projects() {
    // Sanity: editing a sjabloontaak leaves the project/todo tables alone.
    let db = db();
    let tpl = db
        .with_conn(|c| templates::create(c, "HGD-traject", NOW))
        .unwrap();
    db.with_conn(|c| {
        c.execute(
            "INSERT INTO project (name, color, template_id, created_at) VALUES ('P', '#7A8F6E', ?1, ?2)",
            params![tpl.id, NOW],
        )?;
        Ok(())
    })
    .unwrap();
    let tt = db
        .with_conn(|c| {
            templates::create_todo(
                c,
                tpl.id,
                TodoTemplateInput {
                    title: "Stap 1".into(),
                    description: String::new(),
                },
            )
        })
        .unwrap();
    db.with_conn(|c| {
        templates::update_todo(
            c,
            tt.id,
            TodoTemplateInput {
                title: "Stap 1 (bijgewerkt)".into(),
                description: "x".into(),
            },
        )
    })
    .unwrap();

    let todo_rows: i64 = db
        .with_conn(|c| Ok(c.query_row("SELECT COUNT(*) FROM todo", [], |r| r.get(0))?))
        .unwrap();
    assert_eq!(
        todo_rows, 0,
        "editing a template must not create real todos"
    );
}
