# TaskCard

One taak as a Kanban card. Same content as `TaskRow`, stacked instead of in columns:
title (wraps, max ~3 lines), stap-nummer right of the title, project dot + name (or
"Losse taak"), then a meta row with the deadline `MetaChip`, kenmerkwaarden as plain
13px meta text, and a bell + count when the taak has herinneringen.

- No checkbox: selection lives in Lijst and Tabel; the card is dragged, not ticked.
- No `StatusPill`: the column already states the status.
- `dragging` gives the lifted state — teal 2px border, window shadow, -1.2° tilt.
  Nothing else animates.
- `done` mutes title and project text for cards in the afgerond-status column.
- `density="comfortable"` only changes padding (11px 13px → 15px).
