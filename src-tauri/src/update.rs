//! Dagelijkse auto-update met bevestiging vóór het downloaden
//! (spec "Auto-update").
//!
//! Bij het opstarten draait één check als de vorige check van vóór vandaag is
//! (`last_update_check_at`). Geen internet → een **stille no-op**; de stempel
//! wordt ook dan geschreven zodat we niet elke start opnieuw proberen. Vindt de
//! check een nieuwe versie, dan bewaren we die in [`AppState`] en emitten we
//! [`UPDATE_AVAILABLE_EVENT`] naar de webview. Het downloaden/installeren
//! gebeurt **pas** wanneer de UI [`confirm_update`] aanroept.

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;

use takenbeheer_core::settings;

use crate::state::AppState;

/// Event naar de webview: er staat een update klaar (de UI toont haar eigen
/// modal, geen OS-dialoog).
pub const UPDATE_AVAILABLE_EVENT: &str = "update://available";

/// Payload van [`UPDATE_AVAILABLE_EVENT`] — versie + korte toelichting.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub notes: Option<String>,
}

/// Draai de dagelijkse check op een achtergrondtaak. Faalt altijd stil: een
/// gebruiker zonder internet mag hier niets van merken.
pub fn check_on_startup(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let state = app.state::<AppState>();
        let now = takenbeheer_core::clock::now_local_iso();

        let last = state
            .db
            .with_conn(settings::get)
            .ok()
            .and_then(|s| s.last_update_check_at);
        if !settings::update_check_due(last.as_deref(), &now) {
            return;
        }

        run_check(&app).await;

        // Stempel ná de check — ook bij een offline no-op.
        let _ = state.db.with_conn(settings::touch_last_update_check);
    });
}

/// Voer de check uit en, bij een nieuwe versie, meld het aan de UI.
async fn run_check(app: &AppHandle) {
    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            log::debug!("updater niet beschikbaar: {e}");
            return;
        }
    };
    match updater.check().await {
        Ok(Some(update)) => {
            let info = UpdateInfo {
                version: update.version.clone(),
                notes: update.body.clone(),
            };
            app.state::<AppState>().set_pending_update(update);
            let _ = app.emit(UPDATE_AVAILABLE_EVENT, info);
        }
        Ok(None) => log::debug!("geen update beschikbaar"),
        // Offline of feed onbereikbaar: stille no-op.
        Err(e) => log::debug!("updatecheck overgeslagen: {e}"),
    }
}

/// Download + installeer de eerder gevonden update en herstart. Roept de UI aan
/// ná bevestiging in de eigen modal.
#[tauri::command]
pub async fn confirm_update(app: AppHandle) -> Result<(), String> {
    let Some(update) = app.state::<AppState>().take_pending_update() else {
        return Err("Er staat geen update klaar.".into());
    };
    update
        .download_and_install(|_chunk, _total| {}, || {})
        .await
        .map_err(|e| format!("De update kon niet worden geïnstalleerd: {e}"))?;
    app.restart()
}
