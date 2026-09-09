//! Herinneringen-engine (spec §6): `fire_at`-resolutie, de afgeleide
//! toestandsmachine en alle herberekening bij volgorde-, status-, deadline- en
//! projecttoestandwijzigingen. Dit vult de `recalc::*`-stubs uit plannen 2 en 3.
//!
//! **Alles is lokale tijd zonder tijdzone** (spec §6.5). Er is dus geen
//! UTC-conversie en — omdat op naïeve `NaiveDateTime` gerekend wordt — geen
//! echte DST-sprong: een uur-offset is exact `offset_value` uur wandkloktijd ná
//! het ankermoment. Over een DST-grens kan het *getoonde* uur bij de gebruiker
//! één uur schelen; dat is aanvaard gedrag voor v1 en veroorzaakt hier geen
//! panic (alle rekenkunde gaat via `checked_*` / `try_*`).

use chrono::{NaiveDate, NaiveDateTime, NaiveTime, TimeDelta};
use rusqlite::{params, Connection, OptionalExtension};

use crate::clock::now_local_iso;
use crate::error::AppResult;
use crate::models::{
    ReminderAnchor, ReminderBasis, ReminderDefinition, ReminderDirection, ReminderMode,
    ReminderState, ReminderUnit,
};

// ========================================================================
// Datum/tijd-parsing — één plek, tolerant voor "YYYY-MM-DD HH:MM[:SS]".
// ========================================================================

/// Parse a stored local datetime (`"YYYY-MM-DD HH:MM:SS"`, ook zonder seconden
/// of met een `T`-scheider). Een kale datum wordt middernacht.
pub fn parse_dt(s: &str) -> Option<NaiveDateTime> {
    let s = s.trim();
    for fmt in [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M",
    ] {
        if let Ok(dt) = NaiveDateTime::parse_from_str(s, fmt) {
            return Some(dt);
        }
    }
    NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .ok()
        .and_then(|d| d.and_hms_opt(0, 0, 0))
}

fn parse_date(s: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(s.trim(), "%Y-%m-%d").ok()
}

fn parse_time(s: &str) -> Option<NaiveTime> {
    let s = s.trim();
    NaiveTime::parse_from_str(s, "%H:%M:%S")
        .or_else(|_| NaiveTime::parse_from_str(s, "%H:%M"))
        .ok()
}

/// The canonical stored shape (matches `clock::now_local_iso`).
pub fn fmt_dt(dt: NaiveDateTime) -> String {
    dt.format("%Y-%m-%d %H:%M:%S").to_string()
}

// ========================================================================
// `resolve_fire_at` — pure, DB-vrij, uitputtend getest (spec §6.2, §6.5).
// ========================================================================

/// Alles wat `resolve_fire_at` over het anker nodig heeft. Pure input, zodat de
/// hele kruising `anker × basis × eenheid × richting` zonder DB testbaar is.
#[derive(Debug, Clone, Default)]
pub struct ResolveCtx {
    /// De ankertaak bestaat. `false` voor een ontbrekende vorige/volgende buur;
    /// callers voor `this_todo` (en elke absolute herinnering) zetten `true`.
    pub anchor_exists: bool,
    /// Deadline van de ankertaak: datum + optioneel tijdstip. `None` = geen
    /// deadline → geen deadline-ankermoment.
    pub anchor_deadline: Option<(NaiveDate, Option<NaiveTime>)>,
    /// Meest recente `entered_at` voor de triggerstatus op de ankertaak.
    /// `None` = de triggerstatus is (nog) niet bereikt → geen status-ankermoment.
    pub anchor_status_entered_at: Option<NaiveDateTime>,
}

/// Los het lokale vuurmoment op voor élke geldige combinatie, of `None` wanneer
/// er (nog) geen ankermoment is. Ongeldige definities (`before` + status) horen
/// door validatie geweigerd te zijn; hier wordt `status` sowieso als `after`
/// gerekend.
pub fn resolve_fire_at(def: &ReminderDefinition, ctx: &ResolveCtx) -> Option<NaiveDateTime> {
    match def.mode {
        ReminderMode::Absolute => def.fire_at_literal.as_deref().and_then(parse_dt),
        ReminderMode::Relative => {
            if !ctx.anchor_exists {
                return None;
            }
            let basis = def.basis?;
            let base: NaiveDateTime = match basis {
                ReminderBasis::Deadline => {
                    let (date, time) = ctx.anchor_deadline?;
                    NaiveDateTime::new(date, time.unwrap_or(NaiveTime::MIN))
                }
                ReminderBasis::Status => ctx.anchor_status_entered_at?,
            };

            let value = def.offset_value?;
            let unit = def.offset_unit?;
            // `before` bestaat enkel bij een deadline-basis; status is altijd `ná`.
            let signed = match (
                basis,
                def.offset_direction.unwrap_or(ReminderDirection::After),
            ) {
                (ReminderBasis::Deadline, ReminderDirection::Before) => -value,
                _ => value,
            };

            match unit {
                // Uur-offset: exacte verstreken wandkloktijd. `fire_time` telt niet.
                ReminderUnit::Hours => base.checked_add_signed(TimeDelta::try_hours(signed)?),
                // Dag-offset: schuif de dagen en land op `fire_time` van de doeldag
                // (valt `fire_time` weg, dan het uur van het ankermoment).
                ReminderUnit::Days => {
                    let target = base
                        .date()
                        .checked_add_signed(TimeDelta::try_days(signed)?)?;
                    let at = def
                        .fire_time
                        .as_deref()
                        .and_then(parse_time)
                        .unwrap_or_else(|| base.time());
                    Some(NaiveDateTime::new(target, at))
                }
            }
        }
    }
}

// ========================================================================
// `derive_state` — pure toestandsafleiding (spec §6.3).
// ========================================================================

/// De live feiten die de toestand mee bepalen naast de opgeslagen kolommen.
#[derive(Debug, Clone, Copy, Default)]
pub struct StateCtx {
    /// De taak van de herinnering staat op de afgerond-status.
    pub task_is_done: bool,
    /// Het project van de taak is gearchiveerd.
    pub project_archived: bool,
    /// Het vereiste anker (vorige/volgende taak) bestaat. `true` voor
    /// `this_todo` en voor absolute herinneringen.
    pub anchor_exists: bool,
}

/// Leid de toestand af (spec §6.3, elke rij). `fire_at` moet de *actuele*
/// opgeloste waarde zijn (de recalc-hooks houden de kolom vers).
#[allow(clippy::too_many_arguments)]
pub fn derive_state(
    mode: ReminderMode,
    basis: Option<ReminderBasis>,
    anchor: Option<ReminderAnchor>,
    fire_at: Option<&str>,
    fired_at: Option<&str>,
    fired_late: bool,
    seen_at: Option<&str>,
    ctx: &StateCtx,
) -> ReminderState {
    // Terminale / bevestigde toestanden gaan voor.
    if ctx.task_is_done {
        return ReminderState::Done;
    }
    if seen_at.is_some() {
        return ReminderState::Seen;
    }
    if fired_at.is_some() {
        return if fired_late {
            ReminderState::Late
        } else {
            ReminderState::Fired
        };
    }
    if ctx.project_archived {
        return ReminderState::Inactive;
    }

    match mode {
        ReminderMode::Absolute => {
            if fire_at.is_some() {
                ReminderState::Pending
            } else {
                ReminderState::Inactive
            }
        }
        ReminderMode::Relative => {
            let needs_neighbour = matches!(
                anchor,
                Some(ReminderAnchor::PreviousTodo | ReminderAnchor::NextTodo)
            );
            if needs_neighbour && !ctx.anchor_exists {
                return ReminderState::Inactive;
            }
            match basis {
                // Deadline zonder deadline → `fire_at` is `None` → inactive.
                Some(ReminderBasis::Deadline) => {
                    if fire_at.is_some() {
                        ReminderState::Pending
                    } else {
                        ReminderState::Inactive
                    }
                }
                // Triggerstatus nog niet bereikt → `fire_at` is `None` → waiting.
                Some(ReminderBasis::Status) => {
                    if fire_at.is_some() {
                        ReminderState::Pending
                    } else {
                        ReminderState::Waiting
                    }
                }
                None => ReminderState::Inactive,
            }
        }
    }
}

// ========================================================================
// DB-laag: één reminder-rij inladen, context bouwen, `fire_at` wegschrijven.
// ========================================================================

#[derive(Debug, Clone)]
struct ReminderRow {
    todo_id: i64,
    def: ReminderDefinition,
    fired_at: Option<String>,
    fired_late: bool,
    seen_at: Option<String>,
    stored_fire_at: Option<String>,
}

fn str_enum<T: serde::de::DeserializeOwned>(s: Option<String>) -> Option<T> {
    s.and_then(|s| serde_json::from_value(serde_json::Value::String(s)).ok())
}

fn load_row(conn: &Connection, reminder_id: i64) -> AppResult<Option<ReminderRow>> {
    let row = conn
        .query_row(
            "SELECT id, todo_id, mode, fire_at_literal, anchor, basis, trigger_status_id,
                    offset_value, offset_unit, offset_direction, fire_time,
                    fire_at, fired_at, fired_late, seen_at
             FROM reminder WHERE id = ?1",
            params![reminder_id],
            row_from_sql,
        )
        .optional()?;
    Ok(row)
}

fn row_from_sql(r: &rusqlite::Row<'_>) -> rusqlite::Result<ReminderRow> {
    let mode_str: String = r.get(2)?;
    let def = ReminderDefinition {
        id: Some(r.get(0)?),
        mode: if mode_str == "absolute" {
            ReminderMode::Absolute
        } else {
            ReminderMode::Relative
        },
        fire_at_literal: r.get(3)?,
        anchor: str_enum(r.get::<_, Option<String>>(4)?),
        basis: str_enum(r.get::<_, Option<String>>(5)?),
        trigger_status_id: r.get(6)?,
        offset_value: r.get(7)?,
        offset_unit: str_enum(r.get::<_, Option<String>>(8)?),
        offset_direction: str_enum(r.get::<_, Option<String>>(9)?),
        fire_time: r.get(10)?,
        fire_at: r.get(11)?,
        fired_at: r.get(12)?,
        fired_late: r.get::<_, i64>(13)? != 0,
        seen_at: r.get(14)?,
        state: None,
    };
    Ok(ReminderRow {
        todo_id: r.get(1)?,
        fired_at: def.fired_at.clone(),
        fired_late: def.fired_late,
        seen_at: def.seen_at.clone(),
        stored_fire_at: def.fire_at.clone(),
        def,
    })
}

fn reminder_ids_for_todo(conn: &Connection, todo_id: i64) -> AppResult<Vec<i64>> {
    let mut stmt = conn.prepare("SELECT id FROM reminder WHERE todo_id = ?1")?;
    let ids = stmt
        .query_map(params![todo_id], |r| r.get(0))?
        .collect::<Result<_, _>>()?;
    Ok(ids)
}

struct TodoMeta {
    project_id: Option<i64>,
    position: Option<i64>,
    deadline_date: Option<String>,
    deadline_time: Option<String>,
    status_id: i64,
}

fn load_todo_meta(conn: &Connection, todo_id: i64) -> AppResult<Option<TodoMeta>> {
    let m = conn
        .query_row(
            "SELECT project_id, position, deadline_date, deadline_time, status_id
             FROM todo WHERE id = ?1",
            params![todo_id],
            |r| {
                Ok(TodoMeta {
                    project_id: r.get(0)?,
                    position: r.get(1)?,
                    deadline_date: r.get(2)?,
                    deadline_time: r.get(3)?,
                    status_id: r.get(4)?,
                })
            },
        )
        .optional()?;
    Ok(m)
}

/// Resolve which taak the anchor points at. `None` = the required neighbour does
/// not exist (losse taak, or first/last in the project).
fn anchor_todo_id(
    conn: &Connection,
    owner: &TodoMeta,
    anchor: ReminderAnchor,
) -> AppResult<Option<i64>> {
    let (project_id, position) = match (owner.project_id, owner.position) {
        (Some(p), Some(pos)) => (p, pos),
        _ => {
            // Buren bestaan alleen binnen een geordend project.
            return Ok(match anchor {
                ReminderAnchor::ThisTodo => None, // caller uses owner id directly
                _ => None,
            });
        }
    };
    let want_pos = match anchor {
        ReminderAnchor::ThisTodo => return Ok(None),
        ReminderAnchor::PreviousTodo => position - 1,
        ReminderAnchor::NextTodo => position + 1,
    };
    let id = conn
        .query_row(
            "SELECT id FROM todo WHERE project_id = ?1 AND position = ?2",
            params![project_id, want_pos],
            |r| r.get(0),
        )
        .optional()?;
    Ok(id)
}

/// Meest recente `entered_at` voor de triggerstatus op `anchor_id` — met de
/// "teruggezet vóór de trigger"-regel: is de taak sindsdien naar een status
/// *vóór* de trigger in de volgorde gezet, dan telt het ankermoment niet meer
/// (spec §6.4 "Status teruggezet" → `waiting`).
fn status_anchor_moment(
    conn: &Connection,
    anchor_id: i64,
    trigger_status_id: i64,
) -> AppResult<Option<NaiveDateTime>> {
    let last_trigger_at: Option<String> = conn
        .query_row(
            "SELECT MAX(entered_at) FROM todo_status_event
             WHERE todo_id = ?1 AND status_id = ?2",
            params![anchor_id, trigger_status_id],
            |r| r.get(0),
        )
        .optional()?
        .flatten();
    let Some(last_trigger_at) = last_trigger_at else {
        return Ok(None);
    };

    let trigger_pos: Option<i64> = conn
        .query_row(
            "SELECT position FROM status WHERE id = ?1",
            params![trigger_status_id],
            |r| r.get(0),
        )
        .optional()?;

    // Laatste event van de taak dat ná de laatste triggerintrede ligt.
    let later: Option<i64> = conn
        .query_row(
            "SELECT s.position
             FROM todo_status_event e JOIN status s ON s.id = e.status_id
             WHERE e.todo_id = ?1 AND e.entered_at > ?2
             ORDER BY e.entered_at DESC, e.id DESC
             LIMIT 1",
            params![anchor_id, last_trigger_at],
            |r| r.get(0),
        )
        .optional()?;

    if let (Some(tp), Some(lp)) = (trigger_pos, later) {
        if lp < tp {
            // Achteruit gezet, vóór de trigger → geen ankermoment.
            return Ok(None);
        }
    }
    Ok(parse_dt(&last_trigger_at))
}

fn build_resolve_ctx(conn: &Connection, row: &ReminderRow) -> AppResult<ResolveCtx> {
    if row.def.mode == ReminderMode::Absolute {
        return Ok(ResolveCtx {
            anchor_exists: true,
            ..Default::default()
        });
    }
    let Some(owner) = load_todo_meta(conn, row.todo_id)? else {
        return Ok(ResolveCtx::default());
    };
    let Some(anchor) = row.def.anchor else {
        return Ok(ResolveCtx::default());
    };

    let anchor_id = match anchor {
        ReminderAnchor::ThisTodo => Some(row.todo_id),
        _ => anchor_todo_id(conn, &owner, anchor)?,
    };
    let Some(anchor_id) = anchor_id else {
        return Ok(ResolveCtx {
            anchor_exists: false,
            ..Default::default()
        });
    };
    let Some(anchor_meta) = load_todo_meta(conn, anchor_id)? else {
        return Ok(ResolveCtx {
            anchor_exists: false,
            ..Default::default()
        });
    };

    let anchor_deadline = anchor_meta
        .deadline_date
        .as_deref()
        .and_then(parse_date)
        .map(|d| (d, anchor_meta.deadline_time.as_deref().and_then(parse_time)));

    let anchor_status_entered_at = match (row.def.basis, row.def.trigger_status_id) {
        (Some(ReminderBasis::Status), Some(sid)) => status_anchor_moment(conn, anchor_id, sid)?,
        _ => None,
    };

    Ok(ResolveCtx {
        anchor_exists: true,
        anchor_deadline,
        anchor_status_entered_at,
    })
}

fn build_state_ctx(conn: &Connection, row: &ReminderRow, rctx: &ResolveCtx) -> AppResult<StateCtx> {
    let owner = load_todo_meta(conn, row.todo_id)?;
    let (task_is_done, project_archived) = match &owner {
        Some(m) => {
            let is_done: bool = conn
                .query_row(
                    "SELECT is_done FROM status WHERE id = ?1",
                    params![m.status_id],
                    |r| Ok(r.get::<_, i64>(0)? != 0),
                )
                .optional()?
                .unwrap_or(false);
            let archived: bool = match m.project_id {
                Some(pid) => conn
                    .query_row(
                        "SELECT state = 'archived' FROM project WHERE id = ?1",
                        params![pid],
                        |r| Ok(r.get::<_, i64>(0)? != 0),
                    )
                    .optional()?
                    .unwrap_or(false),
                None => false,
            };
            (is_done, archived)
        }
        None => (false, false),
    };
    Ok(StateCtx {
        task_is_done,
        project_archived,
        anchor_exists: rctx.anchor_exists,
    })
}

/// Resolve `fire_at` for one reminder row **and store it**, applying the
/// dedup / reset rules for `fired_at` (spec §6.3, §7):
///   * nieuw `fire_at` is `None` (anker/trigger/deadline weg) → reset:
///     `fired_at` / `fired_late` / `seen_at` gewist;
///   * nieuw `fire_at` ligt in de toekomst en is verschoven → mag opnieuw
///     vuren: dezelfde velden gewist;
///   * anders blijft `fired_at` staan — nooit twee keer vuren.
fn resolve_and_store(conn: &Connection, reminder_id: i64) -> AppResult<()> {
    let Some(row) = load_row(conn, reminder_id)? else {
        return Ok(());
    };
    let rctx = build_resolve_ctx(conn, &row)?;
    let resolved = resolve_fire_at(&row.def, &rctx);
    let new_fire_at = resolved.map(fmt_dt);

    let now = now_local_iso();
    let reset = match (&row.fired_at, &new_fire_at) {
        (Some(_), None) => true,
        (Some(_), Some(nf)) => {
            nf.as_str() != row.stored_fire_at.as_deref().unwrap_or("") && *nf > now
        }
        _ => false,
    };

    if reset {
        conn.execute(
            "UPDATE reminder
             SET fire_at = ?1, fired_at = NULL, fired_late = 0, seen_at = NULL
             WHERE id = ?2",
            params![new_fire_at, reminder_id],
        )?;
    } else {
        conn.execute(
            "UPDATE reminder SET fire_at = ?1 WHERE id = ?2",
            params![new_fire_at, reminder_id],
        )?;
    }
    Ok(())
}

/// Live (niet-schrijvende) resolutie + toestand voor de leespaden
/// (taakdetailpaneel, dashboard). Gebruikt de opgeslagen `fire_at` niet maar
/// rekent vers, zodat de UI altijd klopt.
pub(crate) fn resolved_view(
    conn: &Connection,
    reminder_id: i64,
) -> AppResult<(Option<String>, ReminderState)> {
    let Some(row) = load_row(conn, reminder_id)? else {
        return Ok((None, ReminderState::Inactive));
    };
    let rctx = build_resolve_ctx(conn, &row)?;
    let fire_at = resolve_fire_at(&row.def, &rctx).map(fmt_dt);
    let sctx = build_state_ctx(conn, &row, &rctx)?;
    let state = derive_state(
        row.def.mode,
        row.def.basis,
        row.def.anchor,
        fire_at.as_deref(),
        row.fired_at.as_deref(),
        row.fired_late,
        row.seen_at.as_deref(),
        &sctx,
    );
    Ok((fire_at, state))
}

// ========================================================================
// Herberekening (spec §6.4) — de `recalc::*`-stubs uit plannen 2 & 3.
// ========================================================================

/// Alle herinneringen die *direct* aan `todo_id` hangen opnieuw oplossen.
pub fn recalc_for_todo(conn: &Connection, todo_id: i64) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    for id in reminder_ids_for_todo(&tx, todo_id)? {
        resolve_and_store(&tx, id)?;
    }
    tx.commit()?;
    Ok(())
}

/// Elke `previous_todo` / `next_todo`-herinnering in het project opnieuw
/// oplossen. `_changed_positions` is een hint; we herrekenen het hele project.
pub fn recalc_neighbors(
    conn: &Connection,
    project_id: i64,
    _changed_positions: &[i64],
) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    let ids: Vec<i64> = {
        let mut stmt = tx.prepare(
            "SELECT r.id FROM reminder r JOIN todo t ON t.id = r.todo_id
             WHERE t.project_id = ?1
               AND r.anchor IN ('previous_todo', 'next_todo')",
        )?;
        let out: Vec<i64> = stmt
            .query_map(params![project_id], |r| r.get(0))?
            .collect::<Result<_, _>>()?;
        out
    };
    for id in ids {
        resolve_and_store(&tx, id)?;
    }
    tx.commit()?;
    Ok(())
}

/// Deadline-gebaseerde herinneringen rond één taak (die taak zelf + haar
/// directe buren, want die kunnen er via `previous_todo` / `next_todo` op
/// ankeren).
pub fn recalc_deadline_based(conn: &Connection, todo_id: i64) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    let mut targets = vec![todo_id];
    if let Some(meta) = load_todo_meta(&tx, todo_id)? {
        if let (Some(pid), Some(pos)) = (meta.project_id, meta.position) {
            let mut neighbour = |p: i64| -> AppResult<()> {
                if let Some(id) = tx
                    .query_row(
                        "SELECT id FROM todo WHERE project_id = ?1 AND position = ?2",
                        params![pid, p],
                        |r| r.get::<_, i64>(0),
                    )
                    .optional()?
                {
                    targets.push(id);
                }
                Ok(())
            };
            neighbour(pos - 1)?;
            neighbour(pos + 1)?;
        }
    }
    for t in targets {
        let ids: Vec<i64> = {
            let mut stmt =
                tx.prepare("SELECT id FROM reminder WHERE todo_id = ?1 AND basis = 'deadline'")?;
            let out: Vec<i64> = stmt
                .query_map(params![t], |r| r.get(0))?
                .collect::<Result<_, _>>()?;
            out
        };
        for id in ids {
            resolve_and_store(&tx, id)?;
        }
    }
    tx.commit()?;
    Ok(())
}

/// Status-gebaseerde herinneringen die vanaf `status_id` rekenen opnieuw
/// oplossen (na een statuswissel op de bron of na een hertoewijzing bij het
/// verwijderen van een status).
pub fn recalc_status_based_for_status(conn: &Connection, status_id: i64) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    let ids: Vec<i64> = {
        let mut stmt = tx
            .prepare("SELECT id FROM reminder WHERE basis = 'status' AND trigger_status_id = ?1")?;
        let out: Vec<i64> = stmt
            .query_map(params![status_id], |r| r.get(0))?
            .collect::<Result<_, _>>()?;
        out
    };
    for id in ids {
        resolve_and_store(&tx, id)?;
    }
    tx.commit()?;
    Ok(())
}

/// Project gearchiveerd: alle herinneringen van zijn taken opnieuw oplossen (de
/// toestand volgt vanzelf naar `inactive` zolang het project gearchiveerd is).
pub fn recalc_on_archive(conn: &Connection, project_id: i64) -> AppResult<()> {
    recalc_all_in_project(conn, project_id)
}

/// Project teruggezet: alles opnieuw oplossen. Status-gebaseerde herinneringen
/// waarvan de trigger al viel krijgen een `fire_at` in het verleden en worden zo
/// kandidaat voor een late melding.
pub fn recalc_on_unarchive(conn: &Connection, project_id: i64) -> AppResult<()> {
    recalc_all_in_project(conn, project_id)
}

fn recalc_all_in_project(conn: &Connection, project_id: i64) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    let ids: Vec<i64> = {
        let mut stmt = tx.prepare(
            "SELECT r.id FROM reminder r JOIN todo t ON t.id = r.todo_id
             WHERE t.project_id = ?1",
        )?;
        let out: Vec<i64> = stmt
            .query_map(params![project_id], |r| r.get(0))?
            .collect::<Result<_, _>>()?;
        out
    };
    for id in ids {
        resolve_and_store(&tx, id)?;
    }
    tx.commit()?;
    Ok(())
}

// ========================================================================
// Bevestigen + leescriteria voor de achtergrondtaak + het dashboard.
// ========================================================================

/// "Markeer als gezien" voor één herinnering (spec §6.3 `fired | late → seen`).
pub fn mark_seen(conn: &Connection, reminder_id: i64, now: &str) -> AppResult<()> {
    conn.execute(
        "UPDATE reminder SET seen_at = ?2 WHERE id = ?1 AND seen_at IS NULL",
        params![reminder_id, now],
    )?;
    Ok(())
}

/// Zet elke nu-late herinnering op "gezien" (dashboard-late-banner).
pub fn mark_seen_all_late(conn: &Connection, now: &str) -> AppResult<usize> {
    let n = conn.execute(
        "UPDATE reminder SET seen_at = ?1
         WHERE fired_at IS NOT NULL AND fired_late = 1 AND seen_at IS NULL",
        params![now],
    )?;
    Ok(n)
}

/// Herinneringen die nú moeten vuren: opgelost, nog niet gevuurd, moment
/// verstreken, en niet stilgelegd door de afgerond-status of een gearchiveerd
/// project. Leescriterium voor de achtergrondtaak.
pub fn due_pending(conn: &Connection, now: &str) -> AppResult<Vec<i64>> {
    let mut stmt = conn.prepare(
        "SELECT r.id
         FROM reminder r
         JOIN todo t ON t.id = r.todo_id
         JOIN status s ON s.id = t.status_id
         LEFT JOIN project p ON p.id = t.project_id
         WHERE r.fire_at IS NOT NULL
           AND r.fired_at IS NULL
           AND r.fire_at <= ?1
           AND s.is_done = 0
           AND (p.id IS NULL OR p.state <> 'archived')
         ORDER BY r.fire_at",
    )?;
    let ids = stmt
        .query_map(params![now], |r| r.get(0))?
        .collect::<Result<_, _>>()?;
    Ok(ids)
}

/// Herinneringen waarvan het vuurmoment verstreek **terwijl de app dicht was**:
/// `since < fire_at ≤ now`, nog niet gevuurd/gezien, en niet stilgelegd door de
/// afgerond-status of een gearchiveerd project. `since` is `last_active_at` — de
/// grens van de inhaalronde. Deze krijgen toestand `late` zonder
/// OS-notificatiestortvloed.
pub fn elapsed_while_closed(conn: &Connection, since: &str, now: &str) -> AppResult<Vec<i64>> {
    let mut stmt = conn.prepare(
        "SELECT r.id
         FROM reminder r
         JOIN todo t ON t.id = r.todo_id
         JOIN status s ON s.id = t.status_id
         LEFT JOIN project p ON p.id = t.project_id
         WHERE r.fire_at IS NOT NULL
           AND r.fired_at IS NULL
           AND r.seen_at IS NULL
           AND r.fire_at > ?1
           AND r.fire_at <= ?2
           AND s.is_done = 0
           AND (p.id IS NULL OR p.state <> 'archived')
         ORDER BY r.fire_at",
    )?;
    let ids = stmt
        .query_map(params![since, now], |r| r.get(0))?
        .collect::<Result<_, _>>()?;
    Ok(ids)
}

/// Markeer een herinnering als gevuurd (spec §6.3). `fired_at` is de
/// **dedup-markering** — het schrijven gebeurt alleen wanneer er nog geen
/// `fired_at` staat, dus `set_fired` is idempotent en vuurt nooit twee keer.
/// `late = true` zet meteen de `fired_late`-markering (inhaalronde → toestand
/// `late`). Geeft `true` terug als deze aanroep de markering effectief zette.
pub fn set_fired(conn: &Connection, reminder_id: i64, at: &str, late: bool) -> AppResult<bool> {
    let n = conn.execute(
        "UPDATE reminder SET fired_at = ?2, fired_late = ?3
         WHERE id = ?1 AND fired_at IS NULL",
        params![reminder_id, at, late as i64],
    )?;
    Ok(n > 0)
}

/// Titel + `todo_id` van de taak achter een herinnering — voor de
/// notificatietekst en de deep-link naar het taakdetailpaneel.
pub fn notification_target(
    conn: &Connection,
    reminder_id: i64,
) -> AppResult<Option<(i64, String)>> {
    let row = conn
        .query_row(
            "SELECT t.id, t.title
             FROM reminder r JOIN todo t ON t.id = r.todo_id
             WHERE r.id = ?1",
            params![reminder_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    Ok(row)
}
