-- Migration 0003 — herinneringen-engine (plan 4 §4.2).
--
-- `late` (gevuurd tijdens de inhaalronde) is niet betrouwbaar uit de tijdstippen
-- af te leiden: een herinnering die op tijd vuurt terwijl de app aan staat en
-- een die tijdens de inhaalronde vuurt zetten allebei alleen `fired_at`. We
-- bewaren de bron expliciet als één bool. Plan 5 zet hem bij het vuren; de
-- toestandsmachine (plan 4) leest hem om `fired` van `late` te onderscheiden.
-- Een reset-scenario (status teruggezet vóór het vuurmoment, deadline weg,
-- anker verdwenen) wist `fired_at`/`seen_at` én deze markering.

PRAGMA foreign_keys = ON;

ALTER TABLE reminder
    ADD COLUMN fired_late INTEGER NOT NULL DEFAULT 0 CHECK (fired_late IN (0, 1));
