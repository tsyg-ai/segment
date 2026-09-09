//! Takenbeheer core — business logic + SQLite data layer, usable without Tauri
//! so business rules stay unit-testable.

pub mod attributes;
pub mod calendar;
pub mod clock;
pub mod dashboard;
pub mod db;
pub mod error;
pub mod migrations;
pub mod models;
pub mod onboarding;
pub mod projects;
pub mod recalc;
pub mod reminders;
pub mod seed;
pub mod settings;
pub mod statuses;
pub mod templates;
pub mod todos;
pub mod views;

pub use calendar::{CalendarEvent, CalendarKind, CalendarTone};
pub use dashboard::{DashboardData, DashboardDeadline, DashboardReminder};
pub use db::Db;
pub use error::{AppError, AppResult};
pub use models::{
    AttributeDefinition, AttributeInput, AttributeOption, AttributeScope, AttributeType,
    CreateProjectInput, CreateTodoInput, Link, MoveTodoResult, Project, ProjectState,
    ProjectTemplate, ReminderDefinition, ReminderState, Status, StatusInput,
    TemplateAttributeValue, Todo, TodoAttributeValue, TodoTemplate, TodoTemplateInput,
    UpdateTodoInput,
};
pub use onboarding::OnboardingState;
pub use settings::UserSettings;
pub use views::{AttributeColumn, AttributeFilter, DeadlineFilter, TodoFilter, VisibleCount};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seed_creates_exactly_three_default_statuses() {
        let db = Db::open_in_memory().unwrap();
        let statuses = db.with_conn(seed::list_statuses).unwrap();

        assert_eq!(statuses.len(), 3);

        assert_eq!(statuses[0].name, "Te doen");
        assert_eq!(statuses[0].position, 1);
        assert!(statuses[0].is_default);
        assert!(!statuses[0].is_done);

        assert_eq!(statuses[1].name, "Bezig");
        assert_eq!(statuses[1].position, 2);
        assert!(!statuses[1].is_default);
        assert!(!statuses[1].is_done);

        assert_eq!(statuses[2].name, "Klaar");
        assert_eq!(statuses[2].position, 3);
        assert!(!statuses[2].is_default);
        assert!(statuses[2].is_done);

        // exactly one default, exactly one done
        assert_eq!(statuses.iter().filter(|s| s.is_default).count(), 1);
        assert_eq!(statuses.iter().filter(|s| s.is_done).count(), 1);
    }

    #[test]
    fn seed_is_idempotent_on_a_non_empty_status_table() {
        let db = Db::open_in_memory().unwrap();
        // First call already ran inside Db::open_in_memory.
        let ran_again = db.with_conn(seed::seed_default_statuses).unwrap();
        assert!(!ran_again, "seed must not re-run when status is non-empty");
        assert_eq!(db.with_conn(seed::list_statuses).unwrap().len(), 3);
    }

    #[test]
    fn user_settings_round_trip_including_column_config_json() {
        let db = Db::open_in_memory().unwrap();

        let loaded = db.with_conn(settings::get).unwrap();
        assert!(loaded.run_in_background);
        assert!(!loaded.autostart);

        let mut next = loaded.clone();
        next.last_update_check_at = Some("2026-09-02 08:30:00".to_string());
        next.column_config = serde_json::json!({
            "taken.table": { "columns": ["title", "deadline", "status"], "widths": [320, 120, 110] }
        });
        // v1 forces run_in_background on even if asked otherwise.
        next.run_in_background = false;

        let saved = db.with_conn(|c| settings::set(c, next.clone())).unwrap();
        assert!(saved.run_in_background);

        let reloaded = db.with_conn(settings::get).unwrap();
        assert_eq!(
            reloaded.last_update_check_at.as_deref(),
            Some("2026-09-02 08:30:00")
        );
        assert_eq!(
            reloaded.column_config["taken.table"]["columns"][0],
            serde_json::json!("title")
        );
        assert_eq!(reloaded.column_config, next.column_config);
    }

    #[test]
    fn touch_last_active_updates_the_timestamp() {
        let db = Db::open_in_memory().unwrap();
        db.with_conn(settings::touch_last_active).unwrap();
        let s = db.with_conn(settings::get).unwrap();
        assert!(s.last_active_at.is_some());
    }
}
