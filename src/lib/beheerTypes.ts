/**
 * DTOs for the three beheerpagina's — mirror `core::models`. All datetimes are
 * local wall-clock ISO strings with no offset (spec §1, §6.5).
 */

export type AttributeType = "text" | "number" | "date" | "select" | "checkbox";
export type AttributeScope = "global" | "project";

export interface AttributeOption {
  id: number;
  attributeId: number;
  label: string;
  position: number;
  /** Distinct tasks referencing this option. */
  valueCount: number;
}

export interface AttributeDefinition {
  id: number;
  name: string;
  type: AttributeType;
  scope: AttributeScope;
  templateId: number | null;
  selectMultiple: boolean;
  textMultiline: boolean;
  numberUnit: string | null;
  checkboxDefault: boolean;
  options: AttributeOption[];
  /** Distinct tasks with at least one value for this kenmerk. */
  valueCount: number;
}

export interface AttributeInput {
  name: string;
  type: AttributeType;
  scope?: AttributeScope;
  templateId?: number | null;
  selectMultiple?: boolean;
  textMultiline?: boolean;
  numberUnit?: string | null;
  checkboxDefault?: boolean;
}

export interface StatusInput {
  name: string;
  color: string;
}

export interface ProjectTemplate {
  id: number;
  name: string;
  createdAt: string;
  todoCount: number;
  projectCount: number;
}

export interface TemplateAttributeValue {
  attributeId: number;
  valueText?: string | null;
  valueNumber?: number | null;
  valueDate?: string | null;
  valueBool?: boolean | null;
  optionIds: number[];
}

export interface TemplateLink {
  id: number;
  todoTemplateId: number;
  url: string;
  title: string | null;
}

export interface TodoTemplate {
  id: number;
  templateId: number;
  position: number;
  title: string;
  description: string;
  links: TemplateLink[];
  attributeValues: TemplateAttributeValue[];
  reminders: ReminderDefinition[];
}

export interface TodoTemplateInput {
  title: string;
  description?: string;
}

// --- herinnering *definitie* (output of ReminderPopover) ------------------

export type ReminderMode = "absolute" | "relative";
export type ReminderAnchor = "this_todo" | "previous_todo" | "next_todo";
export type ReminderBasis = "deadline" | "status";
export type ReminderUnit = "days" | "hours";
export type ReminderDirection = "before" | "after";

/** The seven derived herinnering-toestanden (spec §6.3). */
export type ReminderState =
  "pending" | "waiting" | "inactive" | "fired" | "late" | "seen" | "done";

export interface ReminderDefinition {
  /** Present when read back from a template; omitted on create. */
  id?: number | null;
  mode: ReminderMode;
  // absolute
  fireAtLiteral?: string | null;
  // relative
  anchor?: ReminderAnchor | null;
  basis?: ReminderBasis | null;
  triggerStatusId?: number | null;
  offsetValue?: number | null;
  offsetUnit?: ReminderUnit | null;
  offsetDirection?: ReminderDirection | null;
  fireTime?: string | null;
  // runtime — filled for a real taak-herinnering, absent on a template
  fireAt?: string | null;
  firedAt?: string | null;
  firedLate?: boolean;
  seenAt?: string | null;
  state?: ReminderState | null;
}
