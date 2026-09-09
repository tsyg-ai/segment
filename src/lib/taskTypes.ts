/**
 * DTOs for Project & Taak — mirror `core::models`. All datetimes are
 * local wall-clock ISO strings with no offset (spec §1, §6.5).
 */

import type { ReminderDefinition } from "./beheerTypes";

export type ProjectState = "active" | "completed" | "archived";

export interface Project {
  id: number;
  name: string;
  color: string;
  templateId: number | null;
  templateName: string | null;
  state: ProjectState;
  createdAt: string;
  completedAt: string | null;
  archivedAt: string | null;
  todoCount: number;
  doneCount: number;
}

export interface CreateProjectInput {
  name: string;
  color: string;
  templateId?: number | null;
}

export interface Link {
  id: number;
  todoId: number;
  url: string;
  title: string | null;
}

export interface TodoAttributeValue {
  attributeId: number;
  valueText?: string | null;
  valueNumber?: number | null;
  valueDate?: string | null;
  /** Optional "HH:MM" — only meaningful alongside `valueDate`. */
  valueTime?: string | null;
  valueBool?: boolean | null;
  optionIds: number[];
  optionLabels: string[];
}

export interface Todo {
  id: number;
  projectId: number | null;
  position: number | null;
  title: string;
  description: string;
  statusId: number;
  deadlineDate: string | null;
  deadlineTime: string | null;
  createdAt: string;
  links: Link[];
  attributeValues: TodoAttributeValue[];
  reminders: ReminderDefinition[];
}

export interface CreateTodoInput {
  title: string;
  description?: string;
  projectId?: number | null;
  /** Insert-before position within the project (1-based). Omit to append. */
  position?: number | null;
  statusId?: number | null;
  deadlineDate?: string | null;
  deadlineTime?: string | null;
}

export interface UpdateTodoInput {
  title?: string;
  description?: string;
}

export interface MoveTodoResult {
  todo: Todo;
  clearedAttributeIds: number[];
}

/** De project-identiteitsramp (designs/tokens/colors.css, uitgebreid).
    Bewust ingetogen en losstaand van de functionele kleuren: een projectstip
    mag nooit als urgentiesignaal lezen. De eerste vijf zijn de originele
    ramp — nieuwe kleuren zijn achteraan toegevoegd zodat bestaande projecten
    hun kleur behouden. */
export const PROJECT_COLORS: readonly string[] = [
  "#7A8F6E", // salie
  "#A8806B", // klei
  "#8C7391", // pruim
  "#6E8296", // leisteen
  "#C3CBC6", // grijs
  "#5F8F87", // zeegroen
  "#B08A4F", // oker
  "#9C6B6B", // oudroze
  "#7E8B5A", // olijf
  "#6C6F94", // indigo
  "#C08E6A", // abrikoos
  "#86A0A8", // mistblauw
  "#8E7BA6", // lavendel
  "#4F7A63", // dennengroen
  "#A98BA0", // heide
  "#9AA35E", // mosterdgroen
] as const;
