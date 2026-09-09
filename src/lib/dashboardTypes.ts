/**
 * DTOs for the Dashboard, Kalender, onboarding and auto-update surfaces —
 * mirror `core::dashboard`, `core::calendar` and `core::onboarding`.
 * All datetimes are local wall-clock strings with no offset (spec §1, §6.5).
 */
import type { ReminderState } from "./beheerTypes";
import type { Project } from "./taskTypes";

export interface DashboardReminder {
  reminderId: number;
  todoId: number;
  title: string;
  projectName: string | null;
  position: number | null;
  projectTodoCount: number;
  state: ReminderState;
  fireAt: string | null;
  wasLate: boolean;
}

export interface DashboardDeadline {
  todoId: number;
  title: string;
  projectName: string | null;
  position: number | null;
  projectTodoCount: number;
  statusName: string;
  deadlineDate: string;
  deadlineTime: string | null;
  missed: boolean;
}

export interface DashboardData {
  lastActiveAt: string | null;
  lateCount: number;
  reminders: DashboardReminder[];
  deadlines: DashboardDeadline[];
  activeProjects: Project[];
  activeProjectCount: number;
  projectCount: number;
  looseTodoCount: number;
}

export type CalendarKind = "deadline" | "reminder";
export type CalendarTone = "late" | "today" | "neutral" | "done";

export interface CalendarEvent {
  id: string;
  kind: CalendarKind;
  todoId: number;
  title: string;
  projectName: string | null;
  at: string;
  allDay: boolean;
  tone: CalendarTone;
}

export interface OnboardingState {
  hasTemplate: boolean;
  hasProject: boolean;
  hasTodo: boolean;
}

/** Payload of the `update://available` event. */
export interface UpdateInfo {
  version: string;
  notes: string | null;
}
