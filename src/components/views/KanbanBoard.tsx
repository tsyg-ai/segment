import { useMemo, useState, type CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { nl } from "@/i18n";
import type { Todo } from "@/lib/taskTypes";
import type { Status } from "@/lib/statusTypes";
import { tintFromHex } from "@/lib/colorTint";
import { useStatuses } from "@/lib/beheerQueries";
import { useTodoMutations } from "@/lib/taskQueries";
import { useViewPrefs } from "@/lib/viewQueries";
import { deadlineChip } from "@/lib/taskDisplay";
import { Icon } from "@/components/core/Icon";
import { IconButton } from "@/components/core/IconButton";
import { MetaChip } from "@/components/display/MetaChip";

/**
 * Resolve a dnd-kit drop into a status change, or `null` when nothing should
 * happen (dropped outside a column, or onto the card's own column). Pure so the
 * drag → `set_todo_status` wiring is unit-testable.
 */
export function kanbanDrop(
  activeId: string,
  overId: string | null | undefined,
  todos: Todo[],
): { todoId: number; statusId: number } | null {
  if (!overId) return null;
  const todoId = Number(activeId.replace("todo-", ""));
  const statusId = Number(overId.replace("status-", ""));
  const todo = todos.find((t) => t.id === todoId);
  if (!todo || Number.isNaN(statusId) || todo.statusId === statusId) return null;
  return { todoId, statusId };
}

/**
 * Kanban-view (spec §8). Kolommen = **status** in `position`-volgorde. Een kaart
 * naar een andere kolom slepen **wijzigt de status** → `set_todo_status` (schrijft
 * `todo_status_event`, triggert recalc, kan de projecttoestand kantelen).
 * Binnen een kolom een **view-lokale vaste sortering** (titel / deadline /
 * aangemaakt) — geen handmatige volgorde. Bij overloop **schuift het bord
 * horizontaal**. Elke kolomkop heeft een **`+`** om meteen een taak in die
 * status toe te voegen (voorgevulde status).
 */
export function KanbanBoard({
  todos,
  onOpen,
  onQuickAdd,
}: {
  todos: Todo[];
  onOpen: (id: number) => void;
  onQuickAdd: (statusId: number) => void;
}) {
  const { data: statuses = [] } = useStatuses();
  const m = useTodoMutations();
  const { prefs } = useViewPrefs("kanban");
  // Vaste sortering per kolom — zelfde `sort`-pref als de lijst/tabel.
  const sortId = prefs.sort?.id ?? "title";
  const sortDesc = prefs.sort?.desc ?? false;
  const [dragId, setDragId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const ordered = useMemo(
    () => [...statuses].sort((a, b) => a.position - b.position),
    [statuses],
  );

  const byStatus = useMemo(() => {
    const cmp = (a: Todo, b: Todo) => {
      let r: number;
      if (sortId === "title") r = a.title.localeCompare(b.title, "nl");
      else if (sortId === "created") r = a.createdAt.localeCompare(b.createdAt);
      // deadline: taken zonder deadline achteraan
      else
        r = (a.deadlineDate ?? "9999-12-31").localeCompare(
          b.deadlineDate ?? "9999-12-31",
        );
      return sortDesc ? -r : r;
    };
    const map = new Map<number, Todo[]>();
    ordered.forEach((s) => map.set(s.id, []));
    todos.forEach((t) => {
      if (!map.has(t.statusId)) map.set(t.statusId, []);
      map.get(t.statusId)!.push(t);
    });
    map.forEach((list) => list.sort(cmp));
    return map;
  }, [todos, ordered, sortId, sortDesc]);

  const onDragStart = (e: DragStartEvent) =>
    setDragId(Number(String(e.active.id).replace("todo-", "")));

  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const drop = kanbanDrop(
      String(e.active.id),
      e.over ? String(e.over.id) : null,
      todos,
    );
    if (drop) void m.setStatus.mutateAsync(drop);
  };

  const dragTodo = todos.find((t) => t.id === dragId) ?? null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragId(null)}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
          minHeight: 0,
          flex: 1,
        }}
      >
        <div style={board}>
          {ordered.map((status) => (
            <Column
              key={status.id}
              status={status}
              todos={byStatus.get(status.id) ?? []}
              onOpen={onOpen}
              onAdd={() => onQuickAdd(status.id)}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {dragTodo ? <Card todo={dragTodo} onOpen={() => {}} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  todos,
  onOpen,
  onAdd,
}: {
  status: Status;
  todos: Todo[];
  onOpen: (id: number) => void;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `status-${status.id}` });
  // De kolomkop draagt de eigen kleur van de status, met de functionele tinten
  // als terugval wanneer `color` geen bruikbare hex is.
  const dot =
    tintFromHex(status.color) != null
      ? status.color
      : status.isDone
        ? "var(--accent)"
        : status.position === 2
          ? "var(--today-fg)"
          : "var(--text-muted)";
  return (
    <section
      ref={setNodeRef}
      style={{
        ...column,
        background: isOver ? "var(--surface-row-selected)" : "var(--surface-sidebar)",
        borderColor: isOver ? "var(--accent-tint-border)" : "var(--border-default)",
      }}
    >
      <div style={columnHead}>
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 999,
            background: dot,
            flex: "none",
          }}
        />
        <span style={columnName}>{status.name}</span>
        <span style={columnCount}>{todos.length}</span>
        <div style={{ flex: 1 }} />
        <IconButton
          icon="plus"
          label={nl.views.addTaskInStatus(status.name)}
          onClick={onAdd}
        />
      </div>
      <div style={columnBody}>
        {todos.map((t) => (
          <DraggableCard key={t.id} todo={t} onOpen={() => onOpen(t.id)} />
        ))}
      </div>
    </section>
  );
}

function DraggableCard({ todo, onOpen }: { todo: Todo; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `todo-${todo.id}`,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <Card todo={todo} onOpen={onOpen} />
    </div>
  );
}

function Card({
  todo,
  onOpen,
  dragging = false,
}: {
  todo: Todo;
  onOpen: () => void;
  dragging?: boolean;
}) {
  const chip = deadlineChip(todo.deadlineDate, todo.deadlineTime);
  return (
    <div
      onClick={onOpen}
      style={{
        background: "var(--surface-card)",
        border: dragging
          ? "2px solid var(--accent)"
          : "var(--border-width) solid var(--border-default)",
        borderRadius: "var(--radius)",
        boxShadow: dragging ? "var(--shadow-window)" : "var(--shadow-card)",
        padding: "11px 13px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        cursor: dragging ? "grabbing" : "grab",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-4)" }}>
        <span style={cardTitle}>{todo.title}</span>
        <span style={cardPos}>{todo.position ?? "—"}</span>
      </div>
      {chip || todo.reminders.length ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            flexWrap: "wrap",
          }}
        >
          {chip ? <MetaChip tone={chip.tone}>{chip.text}</MetaChip> : null}
          {todo.reminders.length ? (
            <span style={reminderCount}>
              <Icon name="bell" size={13} />
              {todo.reminders.length}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const board: CSSProperties = {
  display: "flex",
  gap: "var(--space-6)",
  overflowX: "auto",
  overflowY: "hidden",
  flex: 1,
  minHeight: 0,
  paddingBottom: "var(--space-4)",
};
const column: CSSProperties = {
  width: 280,
  flex: "none",
  display: "flex",
  flexDirection: "column",
  border: "var(--border-width) solid var(--border-default)",
  borderRadius: "var(--radius)",
  overflow: "hidden",
  transition: "var(--transition)",
};
const columnHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-5)",
  padding: "11px 14px 10px",
  borderBottom: "var(--border-width) solid var(--border-default)",
  flex: "none",
};
const columnName: CSSProperties = {
  fontSize: "var(--text-base)",
  fontWeight: "var(--weight-black)",
  whiteSpace: "nowrap",
};
const columnCount: CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-muted)",
};
const columnBody: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  padding: "var(--space-6)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-5)",
};
const cardTitle: CSSProperties = {
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-bold)",
  lineHeight: 1.3,
  flex: 1,
  minWidth: 0,
};
const cardPos: CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: "var(--weight-black)",
  flex: "none",
  color: "var(--text-muted)",
};
const reminderCount: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "5px",
  fontSize: "var(--text-xs)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-muted)",
};
