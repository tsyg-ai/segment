-- Migration 0001 — full v1 schema (spec "Datamodel", plan 1 §4).
--
-- Conventions:
--   * English identifiers.
--   * All datetimes are LOCAL time with NO stored timezone — ISO-8601 text
--     ("YYYY-MM-DD HH:MM:SS"), or split date/time columns where the spec does
--     (deadline_date / deadline_time). DB helpers must never do UTC conversion.
--   * Booleans are INTEGER 0/1.
--   * created_at / *_at columns are filled by the application layer, not by
--     SQLite defaults, so the value is always local wall-clock time.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Projectsjablonen (spec §3)
-- ---------------------------------------------------------------------------
CREATE TABLE project_template (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE TABLE todo_template (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES project_template(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT ''
    -- no deadline field: sjabloontaken have no deadline (spec)
);
CREATE INDEX idx_todo_template_template ON todo_template(template_id, position);

-- ---------------------------------------------------------------------------
-- Statussen (spec §5)
-- ---------------------------------------------------------------------------
CREATE TABLE status (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL,
    position    INTEGER NOT NULL,
    is_default  INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
    is_done     INTEGER NOT NULL DEFAULT 0 CHECK (is_done IN (0, 1))
);
-- At most one default status.
CREATE UNIQUE INDEX idx_status_single_default ON status(is_default) WHERE is_default = 1;

-- ---------------------------------------------------------------------------
-- Projecten (spec §2, §2.1 toestanden)
-- ---------------------------------------------------------------------------
CREATE TABLE project (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    color        TEXT NOT NULL,
    template_id  INTEGER REFERENCES project_template(id) ON DELETE SET NULL,
    state        TEXT NOT NULL DEFAULT 'active'
                 CHECK (state IN ('active', 'completed', 'archived')),
    created_at   TEXT NOT NULL,
    completed_at TEXT,
    archived_at  TEXT
);
CREATE INDEX idx_project_state ON project(state);

-- ---------------------------------------------------------------------------
-- Taken (spec §1)
-- ---------------------------------------------------------------------------
CREATE TABLE todo (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id    INTEGER REFERENCES project(id) ON DELETE SET NULL,
    position      INTEGER,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    status_id     INTEGER NOT NULL REFERENCES status(id) ON DELETE RESTRICT,
    deadline_date TEXT,          -- "YYYY-MM-DD", local
    deadline_time TEXT,          -- "HH:MM", local, only meaningful with a date
    created_at    TEXT NOT NULL
);
CREATE INDEX idx_todo_project ON todo(project_id, position);
CREATE INDEX idx_todo_status ON todo(status_id);
CREATE INDEX idx_todo_deadline ON todo(deadline_date);

-- ---------------------------------------------------------------------------
-- Statuslog (spec §5.1) — append-only
-- ---------------------------------------------------------------------------
CREATE TABLE todo_status_event (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id    INTEGER NOT NULL REFERENCES todo(id) ON DELETE CASCADE,
    status_id  INTEGER NOT NULL REFERENCES status(id) ON DELETE RESTRICT,
    entered_at TEXT NOT NULL
);
CREATE INDEX idx_todo_status_event_lookup
    ON todo_status_event(todo_id, status_id, entered_at);

-- ---------------------------------------------------------------------------
-- Kenmerken (spec §4)
-- ---------------------------------------------------------------------------
CREATE TABLE attribute_definition (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL,
    type             TEXT NOT NULL
                     CHECK (type IN ('text', 'number', 'date', 'select', 'checkbox')),
    scope            TEXT NOT NULL DEFAULT 'global'
                     CHECK (scope IN ('global', 'project')),
    template_id      INTEGER REFERENCES project_template(id) ON DELETE CASCADE,
    select_multiple  INTEGER NOT NULL DEFAULT 0 CHECK (select_multiple IN (0, 1)),
    text_multiline   INTEGER NOT NULL DEFAULT 0 CHECK (text_multiline IN (0, 1)),
    number_decimals  INTEGER NOT NULL DEFAULT 0
                     CHECK (number_decimals BETWEEN 0 AND 2),
    number_unit      TEXT,
    checkbox_default INTEGER NOT NULL DEFAULT 0 CHECK (checkbox_default IN (0, 1)),
    created_at       TEXT NOT NULL,
    -- project-scoped kenmerken carry a template; global ones do not
    CHECK ((scope = 'project') = (template_id IS NOT NULL))
);
CREATE INDEX idx_attribute_definition_scope
    ON attribute_definition(scope, template_id);

CREATE TABLE attribute_option (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    attribute_id INTEGER NOT NULL
                 REFERENCES attribute_definition(id) ON DELETE CASCADE,
    label        TEXT NOT NULL,
    position     INTEGER NOT NULL
);
CREATE INDEX idx_attribute_option_attr ON attribute_option(attribute_id, position);

-- One row per (todo, attribute) for scalar types; 0..n rows for `select`
-- (one per chosen option). option_id goes NULL when the option is deleted,
-- with option_label_snapshot preserving what was shown.
CREATE TABLE todo_attribute_value (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id               INTEGER NOT NULL REFERENCES todo(id) ON DELETE CASCADE,
    attribute_id          INTEGER NOT NULL
                          REFERENCES attribute_definition(id) ON DELETE CASCADE,
    value_text            TEXT,
    value_number          REAL,
    value_date            TEXT,      -- "YYYY-MM-DD", local
    value_bool            INTEGER CHECK (value_bool IN (0, 1)),
    option_id             INTEGER
                          REFERENCES attribute_option(id) ON DELETE SET NULL,
    option_label_snapshot TEXT
);
CREATE INDEX idx_todo_attribute_value_todo
    ON todo_attribute_value(todo_id, attribute_id);
-- A scalar value is unique per (todo, attribute); select rows (option_id set)
-- are not constrained by this partial index.
CREATE UNIQUE INDEX idx_todo_attribute_value_scalar
    ON todo_attribute_value(todo_id, attribute_id)
    WHERE option_id IS NULL;

-- ---------------------------------------------------------------------------
-- Herinneringen (spec §6)
-- ---------------------------------------------------------------------------
CREATE TABLE reminder (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id           INTEGER NOT NULL REFERENCES todo(id) ON DELETE CASCADE,
    mode              TEXT NOT NULL CHECK (mode IN ('absolute', 'relative')),

    -- absolute
    fire_at_literal   TEXT,          -- datetime, literal, local

    -- relative
    anchor            TEXT CHECK (anchor IN ('this_todo', 'previous_todo', 'next_todo')),
    basis             TEXT CHECK (basis IN ('deadline', 'status')),
    trigger_status_id INTEGER REFERENCES status(id) ON DELETE SET NULL,
    offset_value      INTEGER,
    offset_unit       TEXT CHECK (offset_unit IN ('days', 'hours')),
    offset_direction  TEXT CHECK (offset_direction IN ('before', 'after')),
    fire_time         TEXT,          -- "HH:MM", only when offset_unit = 'days'

    -- runtime (resolved by the reminders engine, plan 4/5)
    fire_at           TEXT,          -- resolved fire moment, local; NULL until resolved
    fired_at          TEXT,          -- also the dedup marker
    seen_at           TEXT,

    created_at        TEXT NOT NULL,

    CHECK (
        (mode = 'absolute' AND fire_at_literal IS NOT NULL)
        OR
        (mode = 'relative' AND anchor IS NOT NULL AND basis IS NOT NULL
            AND offset_value IS NOT NULL AND offset_unit IS NOT NULL
            AND offset_direction IS NOT NULL)
    )
);
CREATE INDEX idx_reminder_todo ON reminder(todo_id);
CREATE INDEX idx_reminder_pending ON reminder(fire_at) WHERE fired_at IS NULL;
CREATE INDEX idx_reminder_trigger_status ON reminder(trigger_status_id);

-- ---------------------------------------------------------------------------
-- Links (spec §1 — url of bestandspad, ongevalideerd)
-- ---------------------------------------------------------------------------
CREATE TABLE link (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id INTEGER NOT NULL REFERENCES todo(id) ON DELETE CASCADE,
    url     TEXT NOT NULL,
    title   TEXT
);
CREATE INDEX idx_link_todo ON link(todo_id);

-- ---------------------------------------------------------------------------
-- Instellingen — single row (id is pinned to 1)
-- ---------------------------------------------------------------------------
CREATE TABLE user_settings (
    id                   INTEGER PRIMARY KEY CHECK (id = 1),
    run_in_background    INTEGER NOT NULL DEFAULT 1 CHECK (run_in_background IN (0, 1)),
    autostart            INTEGER NOT NULL DEFAULT 0 CHECK (autostart IN (0, 1)),
    last_active_at       TEXT,
    last_update_check_at TEXT,
    column_config        TEXT NOT NULL DEFAULT '{}'   -- JSON, per-view table columns
);
