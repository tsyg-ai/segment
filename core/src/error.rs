use serde::Serialize;

/// The one error type crossing the `#[tauri::command]` boundary.
///
/// `code` is a stable machine-readable string; `message` is a ready-to-show
/// Dutch sentence. Serialises to `{ "code": "...", "message": "..." }`.
#[derive(Debug, Clone, Serialize)]
pub struct AppError {
    pub code: String,
    pub message: String,
}

impl AppError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }

    /// The database could not be opened or migrated on startup. Must surface a
    /// clear Dutch message — the app must not crash silently.
    pub fn migration(detail: impl std::fmt::Display) -> Self {
        Self::new(
            "migration_failed",
            format!(
                "De database kon niet worden bijgewerkt: {detail}. Start de app \
                 opnieuw; blijft dit fout gaan, neem dan contact op met de beheerder."
            ),
        )
    }

    pub fn database(detail: impl std::fmt::Display) -> Self {
        Self::new(
            "database_error",
            format!("Er ging iets mis met de database: {detail}."),
        )
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for AppError {}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::database(e)
    }
}

impl From<rusqlite_migration::Error> for AppError {
    fn from(e: rusqlite_migration::Error) -> Self {
        AppError::migration(e)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::new("serde_error", format!("Kon gegevens niet verwerken: {e}."))
    }
}

pub type AppResult<T> = Result<T, AppError>;
