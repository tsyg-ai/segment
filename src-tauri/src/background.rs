//! De herinneringen-achtergrondtaak, de inhaalronde bij het opstarten
//! en de deep-link naar een taak.
//!
//! De **Tokio-achtergrondtaak** draait zolang het proces leeft (venster óf
//! tray — geen tweede codepad). Op een interval vuurt hij verschuldigde
//! herinneringen als **native Windows-notificatie** via
//! `tauri-plugin-notification` en schrijft `fired_at` (de dedup-markering).
//! De **inhaalronde** zet wat verstreek terwijl de app dicht was op `late`,
//! zonder OS-notificaties.

use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

use takenbeheer_core::clock::now_local_iso;
use takenbeheer_core::{reminders, settings, AppError, AppResult};

use crate::state::AppState;

/// Interval van de lus (30–60 s).
const TICK: Duration = Duration::from_secs(45);

/// Event waarop de webview naar de betrokken taak navigeert en het
/// taakdetailpaneel opent.
pub const OPEN_TODO_EVENT: &str = "reminder://open";

/// Grens-fallback voor de inhaalronde bij de allereerste start
/// (`last_active_at` bestaat dan nog niet).
const EPOCH: &str = "1970-01-01 00:00:00";

/// Inhaalronde: herinneringen die verstreken terwijl de app dicht was krijgen
/// `fired_at` + de `late`-markering — **géén** OS-notificatie.
/// `since` is de bij het opstarten gelezen `last_active_at`.
pub fn catch_up(app: &AppHandle, since: Option<String>) {
    let state = app.state::<AppState>();
    let now = now_local_iso();
    let since = since.unwrap_or_else(|| EPOCH.to_string());

    let result = state.db.with_conn(|conn| {
        let ids = reminders::elapsed_while_closed(conn, &since, &now)?;
        for id in &ids {
            reminders::set_fired(conn, *id, &now, true)?;
        }
        Ok(ids.len())
    });

    match result {
        Ok(0) => {}
        Ok(n) => log::info!("inhaalronde: {n} herinnering(en) op 'late' gezet"),
        Err(e) => log::warn!("inhaalronde mislukte: {e}"),
    }
}

/// Start de Tokio-lus. Blijft draaien tot het proces afsluit.
pub fn spawn_reminder_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut ticker = tokio::time::interval(TICK);
        loop {
            ticker.tick().await;
            let app = app.clone();
            // Het tikwerk raakt de blokkerende SQLite-mutex — buiten de async
            // worker houden.
            let _ = tauri::async_runtime::spawn_blocking(move || tick(&app)).await;
        }
    });
}

/// Eén ronde: verschuldigde herinneringen vuren + `last_active_at` bijwerken.
fn tick(app: &AppHandle) {
    let state = app.state::<AppState>();
    let now = now_local_iso();

    let due = match state.db.with_conn(|c| reminders::due_pending(c, &now)) {
        Ok(ids) => ids,
        Err(e) => {
            log::warn!("herinnering-lus: due_pending mislukte: {e}");
            Vec::new()
        }
    };

    for id in due {
        if let Err(e) = fire_one(app, &state, id, &now) {
            // Eén mislukte notificatie stopt de lus niet.
            log::warn!("herinnering {id} niet gevuurd: {e}");
        }
    }

    // `last_active_at` periodiek bijhouden.
    if let Err(e) = state.db.with_conn(settings::touch_last_active) {
        log::warn!("herinnering-lus: last_active_at niet bijgewerkt: {e}");
    }
}

/// Vuur één herinnering: dedup-check, native notificatie, `fired_at` schrijven.
fn fire_one(app: &AppHandle, state: &AppState, reminder_id: i64, now: &str) -> AppResult<()> {
    let target = state
        .db
        .with_conn(|c| reminders::notification_target(c, reminder_id))?;
    let Some((todo_id, title)) = target else {
        return Ok(());
    };

    // Dedup vóór het tonen: `set_fired` is idempotent en geeft `false` als er al
    // een `fired_at` stond — dan niet (nog eens) vuren.
    let newly = state
        .db
        .with_conn(|c| reminders::set_fired(c, reminder_id, now, false))?;
    if !newly {
        return Ok(());
    }

    let body = if title.trim().is_empty() {
        "Een taak vraagt je aandacht.".to_string()
    } else {
        title
    };

    app.notification()
        .builder()
        .title("Herinnering")
        .body(&body)
        .show()
        .map_err(|e| AppError::new("notification_failed", e.to_string()))?;

    // Onthoud de taak zodat een klik op de melding / de tray hem kan openen.
    // `tauri-plugin-notification` levert op desktop geen klik-callback; de tray
    // ("Openen" of linksklik) gebruikt dit als deep-link.
    state.set_last_reminder_todo(todo_id);
    Ok(())
}

/// Haal het venster naar voren (`show` + `unminimize` + `set_focus`) en laat de
/// webview de taak openen. Werkt zowel vanuit de tray als wanneer
/// het venster zichtbaar was.
pub fn focus_and_open(app: &AppHandle, todo_id: i64) {
    show_main_window(app);
    let _ = app.emit(OPEN_TODO_EVENT, todo_id);
}

/// Alleen het venster tonen en focussen (tray "Openen" zonder verse melding).
pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// macOS levert notificaties af onder een **bundle-identifier**, niet onder het
/// proces. In een dev-build doet `tauri-plugin-notification` zich voor als
/// `com.apple.Terminal`; in een release-build gebruikt het onze eigen
/// identifier, die enkel bestaat wanneer de app als `.app`-bundel draait.
/// Beide gevallen falen geruisloos — `show()` spawnt de melding en negeert het
/// resultaat — dus loggen we bij het opstarten waar de meldingen belanden.
#[cfg(target_os = "macos")]
pub fn log_notification_delivery(app: &AppHandle) {
    if tauri::is_dev() {
        log::info!(
            "macOS dev-build: herinneringen komen binnen onder de terminal-app \
             (com.apple.Terminal), niet onder Segment. Staat die uit in \
             Systeeminstellingen > Berichtgeving, dan zie je niets."
        );
        return;
    }

    let bundled = tauri::utils::platform::current_exe()
        .map(|exe| exe.to_string_lossy().contains(".app/Contents/MacOS/"))
        .unwrap_or(false);
    if !bundled {
        log::warn!(
            "Segment draait niet als .app-bundel: macOS kent de identifier {} \
             niet en levert geen enkele herinnering af.",
            app.config().identifier
        );
    }
}

#[cfg(not(target_os = "macos"))]
pub fn log_notification_delivery(_app: &AppHandle) {}
