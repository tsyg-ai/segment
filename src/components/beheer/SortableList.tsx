import { type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * Thin wrapper around dnd-kit for the vertical sleepbare lijsten in Beheer
 * (statussen, keuzelijstopties, sjabloontaken). `onReorder` gets the full new
 * id order — hand it straight to the matching `reorder_*` command.
 */
export function SortableList<T extends { id: number }>({
  items,
  onReorder,
  children,
}: {
  items: T[];
  onReorder: (idsInOrder: number[]) => void;
  children: (item: T, handleProps: SortableHandleProps) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex).map((i) => i.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        {items.map((item) => (
          <SortableRow key={item.id} id={item.id}>
            {(handleProps) => children(item, handleProps)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}

/** Spread `{...attributes} {...listeners}` onto the element that should start a
 *  drag; wire `ref` to it too. Types are loose so any element accepts the spread. */
export interface SortableHandleProps {
  ref: (node: HTMLElement | null) => void;
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown> | undefined;
  isDragging: boolean;
}

function SortableRow({
  id,
  children,
}: {
  id: number;
  children: (handleProps: SortableHandleProps) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        position: "relative",
        zIndex: isDragging ? 1 : "auto",
      }}
    >
      {children({
        ref: setActivatorNodeRef,
        attributes: attributes as unknown as Record<string, unknown>,
        listeners: listeners as unknown as Record<string, unknown> | undefined,
        isDragging,
      })}
    </div>
  );
}
