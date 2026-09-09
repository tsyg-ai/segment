use std::sync::{Arc, Mutex};

use takenbeheer_core::Db;
use tauri_plugin_updater::Update;

/// Application state shared with every `#[tauri::command]`.
pub struct AppState {
    pub db: Arc<Db>,
    /// The `todo_id` of the most recently fired reminder, so a click on the
    /// tray icon (or the tray "Openen" item) can jump straight to that taak.
    /// Consumed once the window is brought forward.
    last_reminder_todo: Mutex<Option<i64>>,
    /// The update found by the daily check, held until the UI confirms it
    /// (bevestiging vóór het downloaden).
    pending_update: Mutex<Option<Update>>,
}

impl AppState {
    pub fn new(db: Db) -> Self {
        Self {
            db: Arc::new(db),
            last_reminder_todo: Mutex::new(None),
            pending_update: Mutex::new(None),
        }
    }

    /// Remember which taak the last native notification belonged to.
    pub fn set_last_reminder_todo(&self, todo_id: i64) {
        *self
            .last_reminder_todo
            .lock()
            .unwrap_or_else(|e| e.into_inner()) = Some(todo_id);
    }

    /// Take (and clear) the pending reminder taak, if any.
    pub fn take_last_reminder_todo(&self) -> Option<i64> {
        self.last_reminder_todo
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .take()
    }

    /// Stash the update the daily check found.
    pub fn set_pending_update(&self, update: Update) {
        *self
            .pending_update
            .lock()
            .unwrap_or_else(|e| e.into_inner()) = Some(update);
    }

    /// Take (and clear) the pending update — called when the UI confirms.
    pub fn take_pending_update(&self) -> Option<Update> {
        self.pending_update
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .take()
    }
}
