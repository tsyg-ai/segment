//! Tauri glue: plugin registration, DB bootstrap, command registration.
//! All real business logic lives in `takenbeheer-core`.

mod background;
mod commands;
mod state;
mod update;

use tauri::{Manager, RunEvent, WindowEvent};

use takenbeheer_core::{settings, Db};

use crate::state::AppState;

/// The database file name inside the per-user app-data directory.
const DB_FILE: &str = "takenbeheer.db";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        // single-instance MUST be the first plugin (Tauri docs).
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus the existing window instead of starting a second process.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build());

    #[cfg(all(desktop, not(any(target_os = "android", target_os = "ios"))))]
    {
        // Present but OFF by default and not UI-configurable in v1 (spec).
        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None::<Vec<&str>>,
        ));
    }

    builder
        .setup(|app| {
            let db = open_database(app.handle())?;

            // Read `last_active_at` *before* we overwrite it — it is the boundary
            // for the inhaalronde.
            let last_active = db
                .with_conn(settings::get)
                .ok()
                .and_then(|s| s.last_active_at);

            app.manage(AppState::new(db));

            // Inhaalronde: wat verstreek terwijl de app dicht was → `late`
            // (geen OS-notificatiestortvloed). Daarna pas de startstempel zetten.
            background::catch_up(app.handle(), last_active);
            let _ = app
                .state::<AppState>()
                .db
                .with_conn(settings::touch_last_active);

            // Waarschuw wanneer macOS de meldingen nergens kan afleveren.
            background::log_notification_delivery(app.handle());

            // De Tokio-achtergrondtaak: draait zolang venster óf tray open is.
            background::spawn_reminder_loop(app.handle().clone());

            // Dagelijkse updatecheck (stil bij offline; bevestiging vóór download).
            update::check_on_startup(app.handle());

            build_tray(app.handle())?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Venster-X = minimaliseren naar de tray, niet afsluiten.
                // Volledig afsluiten kan enkel via het tray-rechtsklikmenu.
                api.prevent_close();
                let _ = window.hide();
                if let Some(state) = window.try_state::<AppState>() {
                    let _ = state.db.with_conn(settings::touch_last_active);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_user_settings,
            commands::set_user_settings,
            commands::list_statuses,
            commands::create_status,
            commands::update_status,
            commands::delete_status,
            commands::reorder_statuses,
            commands::list_attributes,
            commands::create_attribute,
            commands::update_attribute,
            commands::delete_attribute,
            commands::set_attribute_scope,
            commands::create_attribute_option,
            commands::rename_attribute_option,
            commands::delete_attribute_option,
            commands::reorder_attribute_options,
            commands::todos_without_value,
            commands::list_templates,
            commands::create_template,
            commands::update_template,
            commands::delete_template,
            commands::list_template_todos,
            commands::create_template_todo,
            commands::update_template_todo,
            commands::delete_template_todo,
            commands::reorder_template_todos,
            commands::set_template_todo_attribute_value,
            commands::create_template_todo_reminder,
            commands::update_template_todo_reminder,
            commands::delete_template_todo_reminder,
            commands::add_template_todo_link,
            commands::update_template_todo_link,
            commands::delete_template_todo_link,
            commands::list_projects,
            commands::get_project,
            commands::create_project,
            commands::update_project,
            commands::duplicate_project,
            commands::archive_project,
            commands::unarchive_project,
            commands::mark_project_completed,
            commands::delete_project,
            commands::list_todos,
            commands::get_todo,
            commands::create_todo,
            commands::update_todo,
            commands::set_todo_status,
            commands::set_todo_deadline,
            commands::reorder_todos,
            commands::move_todo,
            commands::duplicate_todo,
            commands::delete_todo,
            commands::add_todo_link,
            commands::update_todo_link,
            commands::remove_todo_link,
            commands::set_todo_attribute_value,
            commands::create_todo_reminder,
            commands::update_todo_reminder,
            commands::delete_todo_reminder,
            commands::open_reminder_todo,
            commands::list_todos_view,
            commands::count_visible_and_late,
            commands::list_attribute_columns,
            commands::bulk_set_todo_status,
            commands::bulk_set_todo_deadline,
            commands::bulk_delete_todos,
            commands::get_view_prefs,
            commands::set_view_prefs,
            commands::dashboard_snapshot,
            commands::mark_all_late_seen,
            commands::mark_reminder_seen,
            commands::calendar_events,
            commands::onboarding_state,
            update::confirm_update,
        ])
        .build(tauri::generate_context!())
        .expect("error while building the Segment application")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                if let Some(state) = app_handle.try_state::<AppState>() {
                    let _ = state.db.with_conn(settings::touch_last_active);
                }
            }
        });
}

/// Open the SQLite database in the per-user app-data directory, running
/// migrations + seed. A failure here is fatal and shown to the user in Dutch —
/// the app must not crash silently.
fn open_database(app: &tauri::AppHandle) -> Result<Db, Box<dyn std::error::Error>> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("kon de app-datamap niet bepalen: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("kon de app-datamap niet aanmaken: {e}"))?;
    let path = dir.join(DB_FILE);

    match Db::open(&path) {
        Ok(db) => Ok(db),
        Err(err) => {
            // AppError already carries a Dutch, user-facing message.
            log::error!("database bootstrap mislukt: {err}");
            show_fatal_dialog(app, &err.message);
            Err(Box::new(err))
        }
    }
}

/// Blocking native error dialog — used only for a fatal startup failure so the
/// user sees a clear Dutch message instead of a silent crash.
fn show_fatal_dialog(app: &tauri::AppHandle, message: &str) {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

    app.dialog()
        .message(message)
        .title("Segment kon niet starten")
        .kind(MessageDialogKind::Error)
        .buttons(MessageDialogButtons::Ok)
        .blocking_show();
}

/// The system tray icon (Tauri v2): the app keeps running with the window
/// hidden.
///   * **left click / double click** → show + focus the window (jump to the
///     last fired reminder's taak if there is one);
///   * **right click** → context menu with **"Openen"** and **"Afsluiten"**;
///   * **"Afsluiten"** (`app.exit(0)`) is the *only* way to fully quit.
fn build_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let open = MenuItemBuilder::with_id("open", "Openen").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Afsluiten").build(app)?;
    let menu = MenuBuilder::new(app).items(&[&open, &quit]).build()?;

    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip("Segment — herinneringen komen door")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => open_from_tray(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            }
            | TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            } => open_from_tray(tray.app_handle()),
            _ => {}
        });
    match tray_icon() {
        Ok(icon) => {
            builder = builder.icon(icon);
            // Op macOS mag het sjabloon-icoon meekleuren met de menubalk.
            #[cfg(target_os = "macos")]
            {
                builder = builder.icon_as_template(true);
            }
        }
        // Nooit fataal: zonder eigen icoon valt de tray terug op het
        // vensterpictogram.
        Err(err) => {
            log::warn!("tray-icoon kon niet geladen worden: {err}");
            if let Some(icon) = app.default_window_icon().cloned() {
                builder = builder.icon(icon);
            }
        }
    }
    builder.build(app)?;
    Ok(())
}

/// The monochrome tray artwork, compiled into the binary from `icons/`.
///
/// macOS wants a template image (black + alpha) that the system recolours for
/// the light/dark menubar; Windows and Linux get the white glyph, which is the
/// one that reads on the default dark taskbar.
fn tray_icon() -> tauri::Result<tauri::image::Image<'static>> {
    #[cfg(target_os = "macos")]
    const BYTES: &[u8] = include_bytes!("../icons/tray-icon@2x.png");
    #[cfg(not(target_os = "macos"))]
    const BYTES: &[u8] = include_bytes!("../icons/tray-icon-32-white.png");

    tauri::image::Image::from_bytes(BYTES)
}

/// Bring the app forward from the tray — straight to the last fired reminder's
/// taak when there is one, otherwise just the window.
fn open_from_tray(app: &tauri::AppHandle) {
    match app
        .try_state::<AppState>()
        .and_then(|s| s.take_last_reminder_todo())
    {
        Some(todo_id) => background::focus_and_open(app, todo_id),
        None => background::show_main_window(app),
    }
}

/// Autostart-plumbing: present but **off by default** and **not
/// UI-configurable** in v1. Kept here so a later version can flip it.
#[cfg(all(desktop, not(any(target_os = "android", target_os = "ios"))))]
#[allow(dead_code)]
fn set_autostart(app: &tauri::AppHandle, enable: bool) -> tauri::Result<()> {
    use tauri_plugin_autostart::ManagerExt;

    let manager = app.autolaunch();
    let result = if enable {
        manager.enable()
    } else {
        manager.disable()
    };
    if let Err(e) = result {
        log::warn!(
            "autostart {} mislukte: {e}",
            if enable { "aan" } else { "uit" }
        );
    }
    Ok(())
}
