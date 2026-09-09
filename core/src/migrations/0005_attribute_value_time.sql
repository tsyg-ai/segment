-- Migration 0005 — optioneel tijdstip op een datum-kenmerkwaarde.
--
-- Een `date`-kenmerk gedraagt zich nu zoals het deadlineveld: een datum met een
-- optioneel tijdstip. Het tijdstip staat alleen los bewaard wanneer er ook een
-- datum is (de UI zet het uur pas aan zodra er een datum staat).

PRAGMA foreign_keys = ON;

ALTER TABLE todo_attribute_value
    ADD COLUMN value_time TEXT;      -- "HH:MM", local, alleen samen met value_date
