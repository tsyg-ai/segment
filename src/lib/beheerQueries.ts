import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { invoke } from "./ipc";
import { qk } from "./queryKeys";
import type { Status } from "./statusTypes";
import type {
  AttributeDefinition,
  AttributeInput,
  AttributeScope,
  ProjectTemplate,
  ReminderDefinition,
  TemplateAttributeValue,
  TodoTemplate,
  TodoTemplateInput,
  StatusInput,
} from "./beheerTypes";

/* One place for every TanStack Query / mutation the beheerpagina's use.
   Mutations invalidate the exact keys the beheer screens need. */

function invalidate(qc: QueryClient, keys: readonly (readonly unknown[])[]) {
  keys.forEach((key) => void qc.invalidateQueries({ queryKey: key }));
}

// ---------------------------------------------------------------- statuses

export function useStatuses() {
  return useQuery({
    queryKey: qk.statuses.all,
    queryFn: () => invoke("list_statuses", {}),
  });
}

export function useStatusMutations() {
  const qc = useQueryClient();
  const bump = (next?: Status[]) => {
    if (next) qc.setQueryData(qk.statuses.all, next);
    invalidate(qc, [qk.statuses.all, qk.tasks.all, qk.reminders.all]);
  };
  return {
    create: useMutation({
      mutationFn: (input: StatusInput) => invoke("create_status", { input }),
      onSuccess: () => bump(),
    }),
    update: useMutation({
      mutationFn: (v: { id: number; input: StatusInput }) => invoke("update_status", v),
      onSuccess: () => bump(),
    }),
    remove: useMutation({
      mutationFn: (v: { id: number; reassignTo?: number | null }) =>
        invoke("delete_status", v),
      onSuccess: () => bump(),
    }),
    reorder: useMutation({
      mutationFn: (ids: number[]) => invoke("reorder_statuses", { ids }),
      onSuccess: (next) => bump(next),
    }),
  };
}

// -------------------------------------------------------------- kenmerken

export function useAttributes() {
  return useQuery({
    queryKey: qk.attributes.all,
    queryFn: () => invoke("list_attributes", {}),
  });
}

export function useAttributeMutations() {
  const qc = useQueryClient();
  const bump = (id?: number) => {
    invalidate(qc, [
      qk.attributes.all,
      qk.tasks.all,
      qk.views.all,
      qk.templates.all,
      qk.templates.todosAll,
    ]);
    if (id != null)
      invalidate(qc, [qk.attributes.detail(id), qk.attributes.options(id)]);
  };
  return {
    create: useMutation({
      mutationFn: (input: AttributeInput) => invoke("create_attribute", { input }),
      onSuccess: () => bump(),
    }),
    update: useMutation({
      mutationFn: (v: { id: number; input: AttributeInput }) =>
        invoke("update_attribute", v),
      onSuccess: (a: AttributeDefinition) => bump(a.id),
    }),
    remove: useMutation({
      mutationFn: (id: number) => invoke("delete_attribute", { id }),
      onSuccess: () => bump(),
    }),
    setScope: useMutation({
      mutationFn: (v: { id: number; scope: AttributeScope }) =>
        invoke("set_attribute_scope", v),
      onSuccess: (a: AttributeDefinition) => bump(a.id),
    }),
    addOption: useMutation({
      mutationFn: (v: { attributeId: number; label: string }) =>
        invoke("create_attribute_option", v),
      onSuccess: (_r, v) => bump(v.attributeId),
    }),
    renameOption: useMutation({
      mutationFn: (v: {
        optionId: number;
        newLabel: string;
        applyToExisting: boolean;
        attributeId: number;
      }) =>
        invoke("rename_attribute_option", {
          optionId: v.optionId,
          newLabel: v.newLabel,
          applyToExisting: v.applyToExisting,
        }),
      onSuccess: (_r, v) => bump(v.attributeId),
    }),
    removeOption: useMutation({
      mutationFn: (v: {
        optionId: number;
        clearValues: boolean;
        attributeId: number;
      }) =>
        invoke("delete_attribute_option", {
          optionId: v.optionId,
          clearValues: v.clearValues,
        }),
      onSuccess: (_r, v) => bump(v.attributeId),
    }),
    reorderOptions: useMutation({
      mutationFn: (v: { attributeId: number; ids: number[] }) =>
        invoke("reorder_attribute_options", v),
      onSuccess: (_r, v) => bump(v.attributeId),
    }),
  };
}

// --------------------------------------------------------------- sjablonen

export function useTemplates() {
  return useQuery({
    queryKey: qk.templates.all,
    queryFn: () => invoke("list_templates", {}),
  });
}

export function useTemplateTodos(templateId: number | null) {
  return useQuery({
    queryKey:
      templateId != null ? qk.templates.todos(templateId) : ["template", "none"],
    queryFn: () => invoke("list_template_todos", { templateId: templateId as number }),
    enabled: templateId != null,
  });
}

export function useTemplateMutations(templateId: number | null) {
  const qc = useQueryClient();
  const bumpList = () => invalidate(qc, [qk.templates.all]);
  const bumpTodos = () => {
    if (templateId != null)
      invalidate(qc, [qk.templates.todos(templateId), qk.templates.all]);
  };
  return {
    create: useMutation({
      mutationFn: (name: string) => invoke("create_template", { name }),
      onSuccess: bumpList,
    }),
    rename: useMutation({
      mutationFn: (v: { id: number; name: string }) => invoke("update_template", v),
      onSuccess: bumpList,
    }),
    remove: useMutation({
      mutationFn: (id: number) => invoke("delete_template", { id }),
      onSuccess: bumpList,
    }),
    addTodo: useMutation({
      mutationFn: (v: { templateId: number; input: TodoTemplateInput }) =>
        invoke("create_template_todo", v),
      onSuccess: bumpTodos,
    }),
    updateTodo: useMutation({
      mutationFn: (v: { id: number; input: TodoTemplateInput }) =>
        invoke("update_template_todo", v),
      onSuccess: bumpTodos,
    }),
    removeTodo: useMutation({
      mutationFn: (id: number) => invoke("delete_template_todo", { id }),
      onSuccess: bumpTodos,
    }),
    reorderTodos: useMutation({
      mutationFn: (v: { templateId: number; ids: number[] }) =>
        invoke("reorder_template_todos", v),
      onSuccess: (next: TodoTemplate[]) => {
        if (templateId != null) qc.setQueryData(qk.templates.todos(templateId), next);
        bumpTodos();
      },
    }),
    setTodoAttributeValue: useMutation({
      mutationFn: (v: { todoTemplateId: number; value: TemplateAttributeValue }) =>
        invoke("set_template_todo_attribute_value", v),
      onSuccess: bumpTodos,
    }),
    addReminder: useMutation({
      mutationFn: (v: { todoTemplateId: number; definition: ReminderDefinition }) =>
        invoke("create_template_todo_reminder", v),
      onSuccess: bumpTodos,
    }),
    updateReminder: useMutation({
      mutationFn: (v: { id: number; definition: ReminderDefinition }) =>
        invoke("update_template_todo_reminder", v),
      onSuccess: bumpTodos,
    }),
    removeReminder: useMutation({
      mutationFn: (id: number) => invoke("delete_template_todo_reminder", { id }),
      onSuccess: bumpTodos,
    }),
    addTodoLink: useMutation({
      mutationFn: (v: { todoTemplateId: number; url: string; title: string | null }) =>
        invoke("add_template_todo_link", v),
      onSuccess: bumpTodos,
    }),
    updateTodoLink: useMutation({
      mutationFn: (v: { linkId: number; url: string; title: string | null }) =>
        invoke("update_template_todo_link", v),
      onSuccess: bumpTodos,
    }),
    removeTodoLink: useMutation({
      mutationFn: (linkId: number) => invoke("delete_template_todo_link", { linkId }),
      onSuccess: bumpTodos,
    }),
  };
}

export type { ProjectTemplate };
