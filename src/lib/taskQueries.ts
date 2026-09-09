import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { invoke } from "./ipc";
import { qk } from "./queryKeys";
import type { ReminderDefinition } from "./beheerTypes";
import type {
  CreateProjectInput,
  CreateTodoInput,
  ProjectState,
  Todo,
  TodoAttributeValue,
  UpdateTodoInput,
} from "./taskTypes";

/* Every TanStack Query / mutation the Projecten- en Taken-schermen use.
   Mutations invalidate `['projects', …]`, `['todo', id]`, `['todos', …]`. */

function invalidate(qc: QueryClient, keys: readonly (readonly unknown[])[]) {
  keys.forEach((key) => void qc.invalidateQueries({ queryKey: key }));
}

function bumpAll(qc: QueryClient, todoId?: number) {
  invalidate(qc, [
    qk.projects.all,
    qk.tasks.all,
    qk.views.all,
    // A created/edited task can add or move a deadline (Kalender), flip the
    // onboarding "hasTodo" flag (Taken empty state) or shift the Dashboard.
    qk.calendar.all,
    qk.onboarding.all,
    qk.dashboard.all,
  ]);
  if (todoId != null) invalidate(qc, [qk.tasks.detail(todoId)]);
}

// ---------------------------------------------------------------- projecten

export function useProjects(stateFilter: ProjectState[]) {
  return useQuery({
    queryKey: qk.projects.list(stateFilter),
    queryFn: () => invoke("list_projects", { states: stateFilter }),
  });
}

export function useProject(id: number | null) {
  return useQuery({
    queryKey: id != null ? qk.projects.detail(id) : ["projects", "detail", "none"],
    queryFn: () => invoke("get_project", { id: id as number }),
    enabled: id != null,
  });
}

export function useProjectMutations() {
  const qc = useQueryClient();
  const bump = () => bumpAll(qc);
  return {
    create: useMutation({
      mutationFn: (input: CreateProjectInput) => invoke("create_project", { input }),
      onSuccess: bump,
    }),
    update: useMutation({
      mutationFn: (v: { id: number; name?: string; color?: string }) =>
        invoke("update_project", v),
      onSuccess: bump,
    }),
    duplicate: useMutation({
      mutationFn: (id: number) => invoke("duplicate_project", { id }),
      onSuccess: bump,
    }),
    archive: useMutation({
      mutationFn: (id: number) => invoke("archive_project", { id }),
      onSuccess: bump,
    }),
    unarchive: useMutation({
      mutationFn: (id: number) => invoke("unarchive_project", { id }),
      onSuccess: bump,
    }),
    markCompleted: useMutation({
      mutationFn: (id: number) => invoke("mark_project_completed", { id }),
      onSuccess: bump,
    }),
    remove: useMutation({
      mutationFn: (v: { id: number; typedName: string }) => invoke("delete_project", v),
      onSuccess: bump,
    }),
  };
}

// ------------------------------------------------------------------- taken

export function useTodos(filters: {
  projectId?: number | null;
  looseOnly?: boolean;
  includeArchived?: boolean;
}) {
  return useQuery({
    queryKey: qk.tasks.list(filters as Record<string, unknown>),
    queryFn: () => invoke("list_todos", filters),
  });
}

export function useTodo(id: number | null) {
  return useQuery({
    queryKey: id != null ? qk.tasks.detail(id) : ["tasks", "detail", "none"],
    queryFn: () => invoke("get_todo", { id: id as number }),
    enabled: id != null,
  });
}

export function useTodoMutations() {
  const qc = useQueryClient();
  const done = (todo?: Todo | null) => bumpAll(qc, todo?.id);
  return {
    create: useMutation({
      mutationFn: (input: CreateTodoInput) => invoke("create_todo", { input }),
      onSuccess: () => bumpAll(qc),
    }),
    update: useMutation({
      mutationFn: (v: { id: number; input: UpdateTodoInput }) =>
        invoke("update_todo", v),
      onSuccess: done,
    }),
    setStatus: useMutation({
      mutationFn: (v: { todoId: number; statusId: number }) =>
        invoke("set_todo_status", v),
      onSuccess: done,
    }),
    setDeadline: useMutation({
      mutationFn: (v: { todoId: number; date?: string | null; time?: string | null }) =>
        invoke("set_todo_deadline", v),
      onSuccess: done,
    }),
    reorder: useMutation({
      mutationFn: (v: { projectId: number; ids: number[] }) =>
        invoke("reorder_todos", v),
      onSuccess: () => bumpAll(qc),
    }),
    move: useMutation({
      mutationFn: (v: { todoId: number; targetProjectId?: number | null }) =>
        invoke("move_todo", v),
      onSuccess: (r) => done(r.todo),
    }),
    duplicate: useMutation({
      mutationFn: (id: number) => invoke("duplicate_todo", { id }),
      onSuccess: () => bumpAll(qc),
    }),
    remove: useMutation({
      mutationFn: (id: number) => invoke("delete_todo", { id }),
      onSuccess: () => bumpAll(qc),
    }),
    addLink: useMutation({
      mutationFn: (v: { todoId: number; url: string; title?: string | null }) =>
        invoke("add_todo_link", v),
      onSuccess: done,
    }),
    updateLink: useMutation({
      mutationFn: (v: { linkId: number; url: string; title?: string | null }) =>
        invoke("update_todo_link", v),
      onSuccess: done,
    }),
    removeLink: useMutation({
      mutationFn: (v: { linkId: number }) => invoke("remove_todo_link", v),
      onSuccess: (t) => done(t),
    }),
    setAttributeValue: useMutation({
      mutationFn: (v: { todoId: number; value: TodoAttributeValue }) =>
        invoke("set_todo_attribute_value", v),
      onSuccess: done,
    }),
    addReminder: useMutation({
      mutationFn: (v: { todoId: number; definition: ReminderDefinition }) =>
        invoke("create_todo_reminder", v),
      onSuccess: done,
    }),
    updateReminder: useMutation({
      mutationFn: (v: { id: number; definition: ReminderDefinition }) =>
        invoke("update_todo_reminder", v),
      onSuccess: done,
    }),
    removeReminder: useMutation({
      mutationFn: (id: number) => invoke("delete_todo_reminder", { id }),
      onSuccess: (t) => done(t),
    }),
  };
}
