-- Migration 0004 — links op een sjabloontaak.
--
-- Mirrors `link` (url of bestandspad + optionele titel, ongevalideerd) but hangs
-- off a `todo_template` instead of a real `todo`. The snapshot-instantiatie
-- kopieert deze rijen naar echte `link`-rijen, net als kenmerkwaarden en
-- herinneringdefinities.

PRAGMA foreign_keys = ON;

CREATE TABLE todo_template_link (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_template_id INTEGER NOT NULL
                     REFERENCES todo_template(id) ON DELETE CASCADE,
    url              TEXT NOT NULL,
    title            TEXT
);
CREATE INDEX idx_todo_template_link_todo ON todo_template_link(todo_template_id);
