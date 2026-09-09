# KanbanColumn / KanbanDropGhost

A status column on the Kanban board (spec §8: kolommen = status). Sits in a flex row,
`flex:1`, so hiding a column widens the rest. Header is flex:none, the card list is the
only scroller.

- `tone` colours the header dot: `neutral` (Te doen), `busy` (Bezig), `done` (Klaar).
- `onAdd` renders a plus `IconButton`; pass `note` instead (e.g. "afgerond") for the
  afgerond-status column, where new taken are not created.
- `dropTarget` marks the column a dragged card would land in: teal wash + teal border.
- `KanbanDropGhost` fills the gap the dragged card left in its origin column and states
  where it goes ("Verplaatst naar Klaar").
- There is no manual ordering inside a column; the order comes from the shared
  sorteerkeuze (Deadline / Titel / Aangemaakt).
