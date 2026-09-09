//! Onboarding-toestand (spec §11).
//!
//! De driestapsonboarding (Sjablonen → Projecten → Taken) wordt volledig uit de
//! data afgeleid: bestaat er ≥1 sjabloon? ≥1 project? ≥1 taak? Geen aparte
//! "voltooid"-vlag nodig — de lege toestanden verdwijnen zodra hun teller boven
//! nul komt.

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::error::AppResult;

/// De drie booleans die de lege-toestand-flow sturen.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingState {
    pub has_template: bool,
    pub has_project: bool,
    pub has_todo: bool,
}

/// Leid de onboarding-toestand af uit de tellingen.
pub fn onboarding_state(conn: &Connection) -> AppResult<OnboardingState> {
    let any = |sql: &str| -> AppResult<bool> {
        let n: i64 = conn.query_row(sql, [], |r| r.get(0))?;
        Ok(n > 0)
    };
    Ok(OnboardingState {
        has_template: any("SELECT COUNT(*) FROM project_template")?,
        has_project: any("SELECT COUNT(*) FROM project")?,
        has_todo: any("SELECT COUNT(*) FROM todo")?,
    })
}
