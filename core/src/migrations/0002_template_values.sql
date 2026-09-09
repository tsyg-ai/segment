-- Migration 0002 — sjabloontaak-kenmerkwaarden en sjabloontaak-herinneringdefinities
-- (plan 2 §4). Decision, documented here as the plan asks:
--
--   We use TWO dedicated tables — `todo_template_attribute_value` and
--   `todo_template_reminder` — instead of adding a nullable `todo_template_id`
--   to `todo_attribute_value` / `reminder`.
--
-- Why: both existing tables carry NOT NULL `todo_id` columns and CHECK
-- constraints that assume a real todo (and, for `reminder`, a resolved
-- runtime lifecycle with `fire_at` / `fired_at`). A template value has no
-- todo, no runtime state, and — for a relative reminder — no `fire_at` at all
-- ("wordt per project berekend"). Overloading the runtime tables would mean
-- weakening those constraints for every row. The parallel tables keep the
-- runtime schema strict and make "template definition, not a live row"
-- explicit. Plan 3's snapshot-instantiation copies these into the real
-- `todo_attribute_value` / `reminder` rows.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Pre-set kenmerkwaarden op een sjabloontaak (spec §3, §4).
-- Same value-column shape as `todo_attribute_value`; one row per
-- (todo_template, attribute) for scalars, 0..n for `select` (one per option).
-- No `option_label_snapshot` here: a template is edited in place, snapshots
-- only matter once a value is attached to a real taak.
-- ---------------------------------------------------------------------------
CREATE TABLE todo_template_attribute_value (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_template_id INTEGER NOT NULL
                     REFERENCES todo_template(id) ON DELETE CASCADE,
    attribute_id     INTEGER NOT NULL
                     REFERENCES attribute_definition(id) ON DELETE CASCADE,
    value_text       TEXT,
    value_number     REAL,
    value_date       TEXT,      -- "YYYY-MM-DD", local
    value_bool       INTEGER CHECK (value_bool IN (0, 1)),
    option_id        INTEGER
                     REFERENCES attribute_option(id) ON DELETE CASCADE
);
CREATE INDEX idx_todo_template_attribute_value_todo
    ON todo_template_attribute_value(todo_template_id, attribute_id);
CREATE UNIQUE INDEX idx_todo_template_attribute_value_scalar
    ON todo_template_attribute_value(todo_template_id, attribute_id)
    WHERE option_id IS NULL;

-- ---------------------------------------------------------------------------
-- Herinneringdefinities op een sjabloontaak (spec §3, §6.2).
-- Mirrors the *definition* columns of `reminder` — mode + the relevant
-- fields — but never carries runtime columns (`fire_at`, `fired_at`,
-- `seen_at`). An absolute template reminder stores a literal datetime that
-- applies verbatim to every taak from the sjabloon; a relative one stores the
-- anchor/basis/offset and shows "wordt per project berekend".
-- ---------------------------------------------------------------------------
CREATE TABLE todo_template_reminder (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_template_id  INTEGER NOT NULL
                      REFERENCES todo_template(id) ON DELETE CASCADE,
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

    created_at        TEXT NOT NULL,

    CHECK (
        (mode = 'absolute' AND fire_at_literal IS NOT NULL)
        OR
        (mode = 'relative' AND anchor IS NOT NULL AND basis IS NOT NULL
            AND offset_value IS NOT NULL AND offset_unit IS NOT NULL
            AND offset_direction IS NOT NULL)
    )
);
CREATE INDEX idx_todo_template_reminder_todo
    ON todo_template_reminder(todo_template_id);
CREATE INDEX idx_todo_template_reminder_trigger_status
    ON todo_template_reminder(trigger_status_id);
