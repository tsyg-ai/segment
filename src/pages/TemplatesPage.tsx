import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { nl } from "@/i18n";
import { isAppError } from "@/lib/ipc";
import type {
  AttributeDefinition,
  AttributeInput,
  ProjectTemplate,
  ReminderDefinition,
  TemplateLink,
  TodoTemplate,
} from "@/lib/beheerTypes";
import {
  useTemplates,
  useTemplateMutations,
  useTemplateTodos,
  useAttributes,
  useAttributeMutations,
  useStatuses,
} from "@/lib/beheerQueries";
import { CreateProjectModal } from "./ProjectsPage";
import {
  NewAttributeModal,
  AttributeDetail,
  RenameOptionDialog,
  DeleteOptionDialog,
  typeSummary,
  type OptionDialog,
} from "./AttributesPage";
import {
  BeheerColumns,
  BeheerHeader,
  BeheerLayout,
  AddRowButton,
  DangerLink,
  DetailPanel,
  GroupLabel,
  ListCard,
} from "@/components/beheer/Scaffold";
import { OnboardingEmptyState } from "@/components/onboarding/OnboardingEmptyState";
import {
  SortableList,
  type SortableHandleProps,
} from "@/components/beheer/SortableList";
import { Modal } from "@/components/overlays/Modal";
import { Dialog } from "@/components/overlays/Dialog";
import { ReminderPopover } from "@/components/reminders/ReminderPopover";
import { Icon } from "@/components/core/Icon";
import { Button } from "@/components/core/Button";
import { RowMenu } from "@/components/core/RowMenu";
import { SectionLabel } from "@/components/display/SectionLabel";
import { DateField } from "@/components/forms/DateField";
import { NumberValueField } from "@/components/forms/NumberValueField";

export function TemplatesPage({ navSignal = 0 }: { navSignal?: number }) {
  const { data: templates = [], isLoading, isError } = useTemplates();
  const [openId, setOpenId] = useState<number | null>(null);

  // Sidebar click on "Sjablonen" always returns to the overview.
  useEffect(() => setOpenId(null), [navSignal]);

  const open = useMemo(
    () => templates.find((t) => t.id === openId) ?? null,
    [templates, openId],
  );

  if (open) {
    return <TemplateEditor template={open} onBack={() => setOpenId(null)} />;
  }
  return (
    <TemplateOverview
      templates={templates}
      isLoading={isLoading}
      isError={isError}
      onOpen={setOpenId}
    />
  );
}

// --------------------------------------------------------------- overview

function TemplateOverview({
  templates,
  isLoading,
  isError,
  onOpen,
}: {
  templates: ProjectTemplate[];
  isLoading: boolean;
  isError: boolean;
  onOpen: (id: number) => void;
}) {
  const m = useTemplateMutations(null);
  const [creating, setCreating] = useState(false);
  const [startFromId, setStartFromId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setError(null);
    try {
      const created = await m.create.mutateAsync(name.trim());
      setCreating(false);
      setName("");
      onOpen(created.id);
    } catch (e) {
      setError(isAppError(e) ? e.message : nl.beheer.loadError);
    }
  };

  return (
    <BeheerLayout>
      <BeheerHeader
        title={nl.templates.title}
        count={nl.templates.count(templates.length)}
        intro={nl.templates.intro}
        primaryLabel={nl.templates.newTemplate}
        onPrimary={() => setCreating(true)}
      />
      <BeheerColumns>
        {isLoading ? (
          <p style={mutedP}>{nl.beheer.loading}</p>
        ) : isError ? (
          <p style={mutedP}>{nl.beheer.loadError}</p>
        ) : templates.length === 0 ? (
          <OnboardingEmptyState
            step={1}
            title={nl.onboarding.templates.title}
            body={nl.onboarding.templates.body}
            actionLabel={nl.onboarding.templates.action}
            onAction={() => setCreating(true)}
            hint={nl.onboarding.templates.hint}
          />
        ) : (
          <ListCard>
            {templates.map((t, i) => (
              <div
                key={t.id}
                onClick={() => onOpen(t.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-6)",
                  padding: "14px 18px",
                  borderBottom:
                    i < templates.length - 1
                      ? "var(--border-width) solid var(--border-subtle)"
                      : "none",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-lg)",
                    fontWeight: "var(--weight-black)",
                    letterSpacing: "-0.2px",
                  }}
                >
                  {t.name}
                </span>
                <span
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: "var(--weight-bold)",
                    color: "var(--text-muted)",
                  }}
                >
                  {nl.templates.taskCount(t.todoCount)} ·{" "}
                  {nl.templates.projectsUsing(t.projectCount)}
                </span>
                <div style={{ flex: 1 }} />
                <span
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: "flex", flex: "none" }}
                >
                  <Button variant="secondary" onClick={() => setStartFromId(t.id)}>
                    {nl.templates.startProject}
                  </Button>
                </span>
                <Icon
                  name="chevron-right"
                  size={16}
                  style={{ color: "var(--text-muted)" }}
                />
              </div>
            ))}
          </ListCard>
        )}
      </BeheerColumns>

      {creating ? (
        <Modal
          title={nl.templates.newTemplate}
          description={nl.templates.intro}
          width={520}
          confirmLabel={nl.templates.newTemplate}
          confirmDisabled={!name.trim() || m.create.isPending}
          onConfirm={create}
          onClose={() => setCreating(false)}
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
          >
            <SectionLabel>{nl.templates.nameLabel}</SectionLabel>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={nl.templates.namePlaceholder}
              style={textInput}
            />
            {error ? (
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--weight-bold)",
                  color: "var(--late-fg)",
                }}
              >
                {error}
              </span>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {startFromId != null ? (
        <CreateProjectModal
          initialTemplateId={startFromId}
          lockTemplate
          onClose={() => setStartFromId(null)}
          onCreated={() => {
            setStartFromId(null);
            window.location.hash = "#/projecten";
          }}
        />
      ) : null}
    </BeheerLayout>
  );
}

// ----------------------------------------------------------------- editor

function TemplateEditor({
  template,
  onBack,
}: {
  template: ProjectTemplate;
  onBack: () => void;
}) {
  const { data: todos = [], isLoading } = useTemplateTodos(template.id);
  const { data: attributes = [] } = useAttributes();
  const { data: statuses = [] } = useStatuses();
  const m = useTemplateMutations(template.id);
  const am = useAttributeMutations();

  const [selectedTodoId, setSelectedTodoId] = useState<number | null>(null);
  const [selectedAttrId, setSelectedAttrId] = useState<number | null>(null);
  const [addingTask, setAddingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [templateName, setTemplateName] = useState(template.name);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [deletingTodo, setDeletingTodo] = useState<TodoTemplate | null>(null);
  const [addingAttr, setAddingAttr] = useState(false);
  const [deletingAttr, setDeletingAttr] = useState<AttributeDefinition | null>(null);
  const [optionDialog, setOptionDialog] = useState<OptionDialog>(null);
  const [scopeSwitchAttr, setScopeSwitchAttr] = useState<AttributeDefinition | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const selectedTodo = todos.find((t) => t.id === selectedTodoId) ?? null;
  const relevantAttributes = attributes.filter(
    (a) => a.scope === "global" || a.templateId === template.id,
  );
  const templateAttributes = attributes.filter(
    (a) => a.scope === "project" && a.templateId === template.id,
  );
  const selectedAttr = templateAttributes.find((a) => a.id === selectedAttrId) ?? null;

  const openTodo = (id: number) => {
    setSelectedTodoId(id);
    setSelectedAttrId(null);
  };
  const openAttr = (id: number) => {
    setSelectedAttrId(id);
    setSelectedTodoId(null);
  };

  const run = async (p: Promise<unknown>) => {
    setError(null);
    try {
      await p;
      return true;
    } catch (e) {
      setError(isAppError(e) ? e.message : nl.beheer.loadError);
      return false;
    }
  };

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    let created: TodoTemplate | undefined;
    const ok = await run(
      (async () => {
        created = await m.addTodo.mutateAsync({
          templateId: template.id,
          input: { title: taskTitle.trim() },
        });
      })(),
    );
    if (ok) {
      setTaskTitle("");
      setAddingTask(false);
      // Open (of wissel naar) de zojuist toegevoegde sjabloontaak.
      if (created) openTodo(created.id);
    }
  };

  const duplicateTask = (t: TodoTemplate) =>
    run(
      (async () => {
        const created = await m.addTodo.mutateAsync({
          templateId: template.id,
          input: { title: nl.templates.copyTitle(t.title), description: t.description },
        });
        for (const link of t.links) {
          await m.addTodoLink.mutateAsync({
            todoTemplateId: created.id,
            url: link.url,
            title: link.title,
          });
        }
        for (const value of t.attributeValues) {
          await m.setTodoAttributeValue.mutateAsync({
            todoTemplateId: created.id,
            value,
          });
        }
        for (const reminder of t.reminders) {
          await m.addReminder.mutateAsync({
            todoTemplateId: created.id,
            definition: { ...reminder, id: undefined },
          });
        }
      })(),
    );

  return (
    <BeheerLayout>
      <header
        style={{
          flex: "none",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
          padding: "var(--space-7) var(--gutter) var(--space-6)",
          borderBottom: "var(--border-width) solid var(--border-default)",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            border: 0,
            background: "transparent",
            color: "var(--text-link)",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-sm)",
            fontWeight: "var(--weight-bold)",
            cursor: "pointer",
            width: "fit-content",
            padding: 0,
          }}
        >
          <span style={{ transform: "scaleX(-1)", display: "flex" }}>
            <Icon name="chevron-right" size={13} />
          </span>
          {nl.templates.back}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
          <h1
            onClick={() => {
              setTemplateName(template.name);
              setRenaming(true);
            }}
            style={{
              margin: 0,
              fontSize: "var(--text-3xl)",
              fontWeight: "var(--weight-black)",
              letterSpacing: "var(--tracking-title)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-4)",
            }}
          >
            {template.name}
            <Icon name="pencil" size={16} style={{ color: "var(--text-muted)" }} />
          </h1>
          <span
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-muted)",
            }}
          >
            {nl.templates.taskCount(template.todoCount)} ·{" "}
            {nl.templates.projectsUsing(template.projectCount)}
          </span>
          <div style={{ flex: 1 }} />
          <DangerLink
            label={nl.beheer.delete}
            onClick={() => setDeletingTemplate(true)}
          />
        </div>
      </header>

      {template.projectCount > 0 ? (
        <div
          style={{
            background: "var(--today-bg)",
            borderBottom: "var(--border-width) solid var(--today-border)",
            padding: "9px var(--gutter)",
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            fontSize: "var(--text-sm)",
            fontWeight: "var(--weight-bold)",
            color: "var(--today-fg)",
          }}
        >
          <Icon name="circle-alert" size={16} />
          {nl.templates.changesNote}
        </div>
      ) : null}

      <BeheerColumns
        panel={
          selectedTodo ? (
            <TodoSubEditor
              key={selectedTodo.id}
              todo={selectedTodo}
              index={todos.findIndex((t) => t.id === selectedTodo.id) + 1}
              total={todos.length}
              attributes={relevantAttributes}
              statuses={statuses}
              onClose={() => setSelectedTodoId(null)}
              onUpdate={(input) =>
                void run(m.updateTodo.mutateAsync({ id: selectedTodo.id, input }))
              }
              onSetAttrValue={(value) =>
                void run(
                  m.setTodoAttributeValue.mutateAsync({
                    todoTemplateId: selectedTodo.id,
                    value,
                  }),
                )
              }
              onAddLink={(url, title) =>
                void run(
                  m.addTodoLink.mutateAsync({
                    todoTemplateId: selectedTodo.id,
                    url,
                    title,
                  }),
                )
              }
              onUpdateLink={(linkId, url, title) =>
                void run(m.updateTodoLink.mutateAsync({ linkId, url, title }))
              }
              onRemoveLink={(linkId) => void run(m.removeTodoLink.mutateAsync(linkId))}
              onAddReminder={(definition) =>
                void run(
                  m.addReminder.mutateAsync({
                    todoTemplateId: selectedTodo.id,
                    definition,
                  }),
                )
              }
              onUpdateReminder={(id, definition) =>
                void run(m.updateReminder.mutateAsync({ id, definition }))
              }
              onRemoveReminder={(id) => void run(m.removeReminder.mutateAsync(id))}
              onDelete={() => setDeletingTodo(selectedTodo)}
            />
          ) : selectedAttr ? (
            <AttributeDetail
              key={selectedAttr.id}
              attr={selectedAttr}
              templateName={template.name}
              onClose={() => setSelectedAttrId(null)}
              onRename={(name) =>
                void run(
                  am.update.mutateAsync({
                    id: selectedAttr.id,
                    input: templateAttrToInput(selectedAttr, { name }),
                  }),
                )
              }
              onSetting={(patch) =>
                void run(
                  am.update.mutateAsync({
                    id: selectedAttr.id,
                    input: templateAttrToInput(selectedAttr, patch),
                  }),
                )
              }
              onAddOption={(label) =>
                void run(
                  am.addOption.mutateAsync({ attributeId: selectedAttr.id, label }),
                )
              }
              onReorderOptions={(ids) =>
                void run(
                  am.reorderOptions.mutateAsync({ attributeId: selectedAttr.id, ids }),
                )
              }
              onOptionMenu={(option, kind) =>
                setOptionDialog({ kind, option, attr: selectedAttr })
              }
              onSwitchScope={() => setScopeSwitchAttr(selectedAttr)}
              onDelete={() => setDeletingAttr(selectedAttr)}
            />
          ) : undefined
        }
      >
        {error ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-4)",
              background: "var(--late-bg)",
              border: "var(--border-width) solid var(--late-border)",
              borderRadius: "var(--radius)",
              padding: "10px 14px",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--weight-bold)",
              color: "var(--late-fg)",
            }}
          >
            <Icon name="circle-alert" size={15} />
            {error}
          </div>
        ) : null}

        <GroupLabel
          label={nl.templates.attributesLabel}
          hint={nl.templates.attributesHint}
        />

        {templateAttributes.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-6)",
              background: "var(--surface-card)",
              border: "var(--border-width) solid var(--border-default)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow-card)",
              padding: "15px 18px",
              flex: "none",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-base)",
                fontWeight: "var(--weight-bold)",
                color: "var(--text-muted)",
                lineHeight: "var(--leading-normal)",
                minWidth: 0,
              }}
            >
              {nl.templates.noOwnAttributes}
            </span>
            <div style={{ flex: 1 }} />
            <Button
              variant="secondary"
              onClick={() => setAddingAttr(true)}
              style={{ flex: "none" }}
            >
              {nl.templates.addAttribute}
            </Button>
          </div>
        ) : (
          <>
            <ListCard style={{ flex: "none" }}>
              {templateAttributes.map((a, i) => (
                <div
                  key={a.id}
                  onClick={() => openAttr(a.id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0,1fr) 30px",
                    gap: "var(--space-6)",
                    alignItems: "center",
                    padding: "12px 18px",
                    borderBottom:
                      i < templateAttributes.length - 1
                        ? "var(--border-width) solid var(--border-subtle)"
                        : "none",
                    background:
                      a.id === selectedAttrId
                        ? "var(--surface-row-selected)"
                        : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--text-md)",
                        fontWeight: "var(--weight-black)",
                        letterSpacing: "-0.2px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {a.name}
                    </span>
                    <span
                      style={{
                        fontSize: "var(--text-sm)",
                        fontWeight: "var(--weight-bold)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {typeSummary(a)}
                    </span>
                  </div>
                  <RowMenu
                    items={[
                      {
                        label: nl.beheer.delete,
                        danger: true,
                        onClick: () => setDeletingAttr(a),
                      },
                    ]}
                    label={nl.attributes.title.slice(0, -1)}
                  />
                </div>
              ))}
            </ListCard>
            <button
              type="button"
              onClick={() => setAddingAttr(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "transparent",
                border: 0,
                padding: "0 4px",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-base)",
                fontWeight: "var(--weight-bold)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                width: "fit-content",
              }}
            >
              {nl.templates.addAttribute}
            </button>
          </>
        )}

        <div
          style={{
            height: 1,
            background: "var(--border-default)",
            margin: "5px 0 2px",
            flex: "none",
          }}
        />

        <GroupLabel label={nl.templates.tasksInOrder} hint={nl.beheer.dragToReorder} />

        {isLoading ? (
          <p style={mutedP}>{nl.beheer.loading}</p>
        ) : (
          <ListCard style={{ flex: "none" }}>
            {todos.length === 0 ? (
              <p style={{ ...mutedP, padding: "16px 18px" }}>{nl.beheer.nothing}</p>
            ) : (
              <SortableList
                items={todos}
                onReorder={(ids) =>
                  void run(m.reorderTodos.mutateAsync({ templateId: template.id, ids }))
                }
              >
                {(t, handle) => (
                  <TemplateTaskRow
                    todo={t}
                    index={todos.findIndex((x) => x.id === t.id) + 1}
                    active={t.id === selectedTodoId}
                    attributeName={(id) =>
                      attributes.find((a) => a.id === id)?.name ?? "?"
                    }
                    onOpen={() => openTodo(t.id)}
                    onDuplicate={() => void duplicateTask(t)}
                    onDelete={() => setDeletingTodo(t)}
                    handle={handle}
                  />
                )}
              </SortableList>
            )}
          </ListCard>
        )}

        <AddRowButton
          label={`${nl.templates.addTask}`}
          onClick={() => setAddingTask(true)}
        />
      </BeheerColumns>

      {addingTask ? (
        <Modal
          title={nl.templates.addTask}
          width={520}
          confirmLabel={nl.beheer.add}
          confirmDisabled={!taskTitle.trim() || m.addTodo.isPending}
          onConfirm={addTask}
          onClose={() => setAddingTask(false)}
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
          >
            <SectionLabel>{nl.templates.taskTitleLabel}</SectionLabel>
            <input
              autoFocus
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="bv. Intakegesprek inplannen"
              style={textInput}
            />
          </div>
        </Modal>
      ) : null}

      {addingAttr ? (
        <NewAttributeModal
          templates={[{ id: template.id, name: template.name }]}
          lockedTemplateId={template.id}
          pending={am.create.isPending}
          onClose={() => setAddingAttr(false)}
          onSubmit={async (input, options) => {
            const ok = await run(
              (async () => {
                const created = await am.create.mutateAsync(input);
                for (const label of options) {
                  await am.addOption.mutateAsync({ attributeId: created.id, label });
                }
              })(),
            );
            if (ok) setAddingAttr(false);
          }}
        />
      ) : null}

      {deletingAttr ? (
        <Dialog
          title={nl.attributes.deleteAttributeTitle(deletingAttr.name)}
          description={nl.attributes.deleteAttributeBody(deletingAttr.valueCount)}
          confirmLabel={nl.beheer.delete}
          confirmVariant="danger"
          onConfirm={async () => {
            const ok = await run(am.remove.mutateAsync(deletingAttr.id));
            if (ok) {
              if (selectedAttrId === deletingAttr.id) setSelectedAttrId(null);
              setDeletingAttr(null);
            }
          }}
          onCancel={() => setDeletingAttr(null)}
        />
      ) : null}

      {optionDialog?.kind === "rename" ? (
        <RenameOptionDialog
          dialog={optionDialog}
          onClose={() => setOptionDialog(null)}
          onConfirm={async (newLabel, applyToExisting) => {
            const ok = await run(
              am.renameOption.mutateAsync({
                optionId: optionDialog.option.id,
                newLabel,
                applyToExisting,
                attributeId: optionDialog.attr.id,
              }),
            );
            if (ok) setOptionDialog(null);
          }}
        />
      ) : null}

      {optionDialog?.kind === "delete" ? (
        <DeleteOptionDialog
          dialog={optionDialog}
          onClose={() => setOptionDialog(null)}
          onConfirm={async (clearValues) => {
            const ok = await run(
              am.removeOption.mutateAsync({
                optionId: optionDialog.option.id,
                clearValues,
                attributeId: optionDialog.attr.id,
              }),
            );
            if (ok) setOptionDialog(null);
          }}
        />
      ) : null}

      {scopeSwitchAttr ? (
        <Dialog
          title={nl.attributes.scopeSwitchTitle(scopeSwitchAttr.name)}
          description={nl.attributes.scopeSwitchBody}
          warning={
            <>
              <Icon name="circle-alert" size={16} />
              {nl.attributes.scopeSwitchWarning}
            </>
          }
          confirmLabel={nl.attributes.scopeSwitchVerb}
          onConfirm={async () => {
            const ok = await run(
              am.setScope.mutateAsync({ id: scopeSwitchAttr.id, scope: "global" }),
            );
            if (ok) {
              setScopeSwitchAttr(null);
              setSelectedAttrId(null);
            }
          }}
          onCancel={() => setScopeSwitchAttr(null)}
        />
      ) : null}

      {renaming ? (
        <Modal
          title={nl.beheer.edit}
          width={520}
          confirmLabel={nl.beheer.save}
          confirmDisabled={!templateName.trim() || m.rename.isPending}
          onConfirm={async () => {
            const ok = await run(
              m.rename.mutateAsync({ id: template.id, name: templateName.trim() }),
            );
            if (ok) setRenaming(false);
          }}
          onClose={() => setRenaming(false)}
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
          >
            <SectionLabel>{nl.templates.nameLabel}</SectionLabel>
            <input
              autoFocus
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              style={textInput}
            />
          </div>
        </Modal>
      ) : null}

      {deletingTemplate ? (
        <Dialog
          title={nl.templates.deleteTemplateTitle(template.name)}
          description={nl.templates.deleteTemplateBody(template.projectCount)}
          confirmLabel={nl.beheer.delete}
          confirmVariant="danger"
          onConfirm={async () => {
            const ok = await run(m.remove.mutateAsync(template.id));
            if (ok) onBack();
          }}
          onCancel={() => setDeletingTemplate(false)}
        />
      ) : null}

      {deletingTodo ? (
        <Dialog
          title={nl.templates.deleteTaskTitle(deletingTodo.title)}
          description={nl.templates.deleteTaskBody}
          confirmLabel={nl.beheer.delete}
          confirmVariant="danger"
          onConfirm={async () => {
            const ok = await run(m.removeTodo.mutateAsync(deletingTodo.id));
            if (ok) {
              if (selectedTodoId === deletingTodo.id) setSelectedTodoId(null);
              setDeletingTodo(null);
            }
          }}
          onCancel={() => setDeletingTodo(null)}
        />
      ) : null}
    </BeheerLayout>
  );
}

function templateAttrToInput(
  a: AttributeDefinition,
  patch: Partial<AttributeInput>,
): AttributeInput {
  return {
    name: a.name,
    type: a.type,
    selectMultiple: a.selectMultiple,
    textMultiline: a.textMultiline,
    numberUnit: a.numberUnit,
    checkboxDefault: a.checkboxDefault,
    ...patch,
  };
}

function TemplateTaskRow({
  todo,
  index,
  active,
  attributeName,
  onOpen,
  onDuplicate,
  onDelete,
  handle,
}: {
  todo: TodoTemplate;
  index: number;
  active: boolean;
  attributeName: (id: number) => string;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  handle: SortableHandleProps;
}) {
  return (
    <div
      onClick={onOpen}
      style={{
        display: "grid",
        gridTemplateColumns: "30px minmax(0,1fr) 30px",
        gap: "var(--space-6)",
        alignItems: "start",
        padding: "12px 18px",
        borderBottom: "var(--border-width) solid var(--border-subtle)",
        background: active ? "var(--surface-row-selected)" : "transparent",
        cursor: "pointer",
      }}
    >
      <span
        ref={handle.ref}
        {...handle.attributes}
        {...handle.listeners}
        title={nl.beheer.dragToReorder}
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: "var(--weight-black)",
          color: "var(--text-muted)",
          paddingTop: 2,
          cursor: "grab",
        }}
      >
        {index}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
        <span
          style={{
            fontSize: "var(--text-md)",
            fontWeight: "var(--weight-bold)",
            lineHeight: "var(--leading-snug)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {todo.title}
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
          {todo.attributeValues.map((v) => (
            <span key={v.attributeId} style={chipTag}>
              {attributeName(v.attributeId)}
            </span>
          ))}
          {todo.links.map((l) => (
            <span
              key={l.id}
              style={{
                ...chipTag,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                maxWidth: 180,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              <Icon name="arrow-up-right" size={12} />
              {l.title || l.url}
            </span>
          ))}
          {todo.reminders.map((r, i) => (
            <span
              key={r.id ?? i}
              style={{
                ...chipTag,
                background: "var(--accent-tint)",
                border: "var(--border-width) solid var(--accent-tint-border)",
                color: "var(--accent-text)",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Icon name="bell" size={12} />
              {reminderSummary(r)}
            </span>
          ))}
        </div>
      </div>
      <RowMenu
        items={[
          { label: nl.beheer.duplicate, onClick: onDuplicate },
          { label: nl.beheer.delete, danger: true, onClick: onDelete },
        ]}
      />
    </div>
  );
}

export function reminderSummary(r: ReminderDefinition): string {
  if (r.mode === "absolute") {
    return r.fireAtLiteral ? `Op ${r.fireAtLiteral.slice(0, 16)}` : "Vaste datum";
  }
  const unit =
    r.offsetUnit === "hours"
      ? r.offsetValue === 1
        ? "uur"
        : "uren"
      : r.offsetValue === 1
        ? "dag"
        : "dagen";
  const dir =
    r.basis === "status" ? "ná" : r.offsetDirection === "before" ? "vóór" : "ná";
  const base = r.basis === "status" ? "de status" : "de deadline";
  const anchor =
    r.anchor === "previous_todo"
      ? "de vorige taak"
      : r.anchor === "next_todo"
        ? "de volgende taak"
        : "deze taak";
  return `${r.offsetValue} ${unit} ${dir} ${base} van ${anchor}`;
}

// -------------------------------------------------------------- sub-editor

function TodoSubEditor({
  todo,
  index,
  total,
  attributes,
  statuses,
  onClose,
  onUpdate,
  onSetAttrValue,
  onAddLink,
  onUpdateLink,
  onRemoveLink,
  onAddReminder,
  onUpdateReminder,
  onRemoveReminder,
  onDelete,
}: {
  todo: TodoTemplate;
  index: number;
  total: number;
  attributes: import("@/lib/beheerTypes").AttributeDefinition[];
  statuses: import("@/lib/statusTypes").Status[];
  onClose: () => void;
  onUpdate: (input: { title: string; description?: string }) => void;
  onSetAttrValue: (value: import("@/lib/beheerTypes").TemplateAttributeValue) => void;
  onAddLink: (url: string, title: string | null) => void;
  onUpdateLink: (linkId: number, url: string, title: string | null) => void;
  onRemoveLink: (linkId: number) => void;
  onAddReminder: (definition: ReminderDefinition) => void;
  onUpdateReminder: (id: number, definition: ReminderDefinition) => void;
  onRemoveReminder: (id: number) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description);
  const [reminderEditor, setReminderEditor] = useState<
    { mode: "new" } | { mode: "edit"; def: ReminderDefinition } | null
  >(null);
  const [linkDialog, setLinkDialog] = useState<
    { mode: "new" } | { mode: "edit"; link: TemplateLink } | null
  >(null);

  const openLink = (u: string) => {
    const isUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(u) || u.startsWith("mailto:");
    void (isUrl ? openUrl(u) : openPath(u)).catch(() => {});
  };

  const commit = () => {
    if (
      title.trim() &&
      (title.trim() !== todo.title || description !== todo.description)
    ) {
      onUpdate({ title: title.trim(), description });
    }
  };

  const valueFor = (attrId: number) =>
    todo.attributeValues.find((v) => v.attributeId === attrId);

  return (
    <DetailPanel
      kicker={nl.templates.subEditorPlace(index, total)}
      title={
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          style={{
            ...textInput,
            fontSize: "var(--text-md)",
            fontWeight: "var(--weight-black)",
          }}
        />
      }
      subtitle={nl.templates.noDeadline}
      onClose={onClose}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <SectionLabel>{nl.templates.taskDescriptionLabel}</SectionLabel>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={commit}
          rows={3}
          style={{
            ...textInput,
            height: "auto",
            padding: "10px 13px",
            fontWeight: "var(--weight-medium)",
            resize: "vertical",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <SectionLabel>{nl.templates.attributesLabel}</SectionLabel>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}
        >
          {attributes.map((a) => (
            <TemplateAttributeField
              key={a.id}
              attribute={a}
              value={valueFor(a.id)}
              onChange={onSetAttrValue}
            />
          ))}
          {attributes.length === 0 ? (
            <span style={helpText}>Nog geen kenmerken om vooraf in te vullen.</span>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
          alignItems: "flex-start",
        }}
      >
        <SectionLabel>{nl.templates.linksLabel}</SectionLabel>
        {todo.links.length > 0 ? (
          <ListCard style={{ width: "100%" }}>
            {todo.links.map((l, i) => (
              <div
                key={l.id}
                style={{
                  padding: "11px 13px",
                  borderBottom:
                    i < todo.links.length - 1
                      ? "var(--border-width) solid var(--border-subtle)"
                      : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-4)",
                }}
              >
                <button
                  type="button"
                  onClick={() => openLink(l.url)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    border: 0,
                    background: "transparent",
                    padding: 0,
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-base)",
                    fontWeight: "var(--weight-bold)",
                    color: "var(--text-link)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Icon name="arrow-up-right" size={13} />
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {l.title || l.url}
                  </span>
                </button>
                <RowMenu
                  items={[
                    {
                      label: nl.beheer.edit,
                      onClick: () => setLinkDialog({ mode: "edit", link: l }),
                    },
                    {
                      label: nl.beheer.delete,
                      danger: true,
                      onClick: () => onRemoveLink(l.id),
                    },
                  ]}
                  label={nl.templates.linksLabel}
                />
              </div>
            ))}
          </ListCard>
        ) : null}
        <button
          type="button"
          onClick={() => setLinkDialog({ mode: "new" })}
          style={smallSecondary}
        >
          {nl.tasks.addLink}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
          alignItems: "flex-start",
        }}
      >
        <SectionLabel>{nl.templates.remindersLabel}</SectionLabel>
        {todo.reminders.length > 0 ? (
          <ListCard style={{ width: "100%" }}>
            {todo.reminders.map((r, i) => (
              <div
                key={r.id ?? i}
                onClick={() => setReminderEditor({ mode: "edit", def: r })}
                style={{
                  padding: "11px 13px",
                  borderBottom:
                    i < todo.reminders.length - 1
                      ? "var(--border-width) solid var(--border-subtle)"
                      : "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-4)",
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: "var(--text-base)",
                      fontWeight: "var(--weight-bold)",
                      color: "var(--text-body)",
                    }}
                  >
                    {reminderSummary(r)}
                  </span>
                  {r.id != null ? (
                    <RowMenu
                      items={[
                        {
                          label: nl.beheer.delete,
                          danger: true,
                          onClick: () => onRemoveReminder(r.id as number),
                        },
                      ]}
                    />
                  ) : null}
                </div>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: "var(--weight-bold)",
                    color: "var(--text-muted)",
                  }}
                >
                  {r.mode === "relative" ? nl.templates.perProject : "Vaste datum"}
                </span>
              </div>
            ))}
          </ListCard>
        ) : null}
        <button
          type="button"
          onClick={() => setReminderEditor({ mode: "new" })}
          style={smallSecondary}
        >
          {nl.templates.addReminder}
        </button>
      </div>

      <DangerLink label={nl.beheer.delete} onClick={onDelete} />

      {reminderEditor ? (
        <div
          role="presentation"
          onClick={() => setReminderEditor(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--scrim)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
          }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <ReminderPopover
              statuses={statuses}
              allowSiblings
              context="template"
              initial={reminderEditor.mode === "edit" ? reminderEditor.def : undefined}
              submitLabel={
                reminderEditor.mode === "edit" ? nl.beheer.save : nl.beheer.add
              }
              onCancel={() => setReminderEditor(null)}
              onSubmit={(definition) => {
                if (reminderEditor.mode === "edit" && reminderEditor.def.id != null) {
                  onUpdateReminder(reminderEditor.def.id, definition);
                } else {
                  onAddReminder(definition);
                }
                setReminderEditor(null);
              }}
            />
          </div>
        </div>
      ) : null}

      {linkDialog ? (
        <TemplateLinkDialog
          initial={linkDialog.mode === "edit" ? linkDialog.link : undefined}
          onCancel={() => setLinkDialog(null)}
          onSave={(url, title) => {
            if (linkDialog.mode === "edit") {
              onUpdateLink(linkDialog.link.id, url, title);
            } else {
              onAddLink(url, title);
            }
            setLinkDialog(null);
          }}
          onDelete={
            linkDialog.mode === "edit"
              ? () => {
                  onRemoveLink(linkDialog.link.id);
                  setLinkDialog(null);
                }
              : undefined
          }
        />
      ) : null}
    </DetailPanel>
  );
}

function TemplateLinkDialog({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: TemplateLink;
  onSave: (url: string, title: string | null) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [url, setUrl] = useState(initial?.url ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  return (
    <Dialog
      title={initial ? nl.tasks.linkEditTitle : nl.tasks.linkAddTitle}
      confirmLabel={initial ? nl.beheer.save : nl.beheer.add}
      confirmDisabled={!url.trim()}
      onConfirm={() => url.trim() && onSave(url.trim(), title.trim() || null)}
      onCancel={onCancel}
      note={
        onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            style={{
              border: 0,
              background: "transparent",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--weight-bold)",
              color: "var(--late-fg)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            {nl.beheer.delete}
          </button>
        ) : undefined
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <label
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
        >
          <SectionLabel>{nl.tasks.linkUrlCaption}</SectionLabel>
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={nl.tasks.linkUrlPlaceholder}
            style={textInput}
          />
        </label>
        <label
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
        >
          <SectionLabel>{nl.tasks.linkTitleCaption}</SectionLabel>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={textInput}
          />
        </label>
      </div>
    </Dialog>
  );
}

function TemplateAttributeField({
  attribute,
  value,
  onChange,
}: {
  attribute: import("@/lib/beheerTypes").AttributeDefinition;
  value: import("@/lib/beheerTypes").TemplateAttributeValue | undefined;
  onChange: (value: import("@/lib/beheerTypes").TemplateAttributeValue) => void;
}) {
  const base = { attributeId: attribute.id, optionIds: [] as number[] };
  return (
    <label
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: "9px 14px",
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: "var(--weight-semibold)",
          color: "var(--text-muted)",
        }}
      >
        {attribute.name}
      </span>
      {attribute.type === "select" ? (
        <select
          value={value?.optionIds[0] ?? ""}
          onChange={(e) =>
            onChange({
              ...base,
              optionIds: e.target.value ? [Number(e.target.value)] : [],
            })
          }
          style={{ ...textInput, height: 32, justifySelf: "start", width: "auto" }}
        >
          <option value="">{nl.templates.leaveEmpty}</option>
          {attribute.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      ) : attribute.type === "checkbox" ? (
        <input
          type="checkbox"
          checked={value?.valueBool ?? attribute.checkboxDefault}
          onChange={(e) => onChange({ ...base, valueBool: e.target.checked })}
          style={{ justifySelf: "start" }}
        />
      ) : attribute.type === "number" ? (
        <NumberValueField
          value={value?.valueNumber}
          unit={attribute.numberUnit}
          ariaLabel={attribute.name}
          style={{ ...textInput, height: 32, justifySelf: "start", width: 120 }}
          onCommit={(valueNumber) => onChange({ ...base, valueNumber })}
        />
      ) : attribute.type === "date" ? (
        <DateField
          value={value?.valueDate ?? ""}
          onChange={(iso) => onChange({ ...base, valueDate: iso || null })}
          aria-label={attribute.name}
          style={{ ...textInput, height: 32, justifySelf: "start", width: "auto" }}
        />
      ) : (
        <input
          defaultValue={value?.valueText ?? ""}
          onBlur={(e) => onChange({ ...base, valueText: e.target.value || null })}
          style={{ ...textInput, height: 32, justifySelf: "start" }}
        />
      )}
    </label>
  );
}

const mutedP: CSSProperties = {
  margin: 0,
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-medium)",
  color: "var(--text-secondary)",
};
const helpText: CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: "var(--weight-semibold)",
  color: "var(--text-muted)",
  lineHeight: "var(--leading-snug)",
};
const textInput: CSSProperties = {
  height: 40,
  border: "var(--border-width) solid var(--border-default)",
  borderRadius: "var(--radius)",
  padding: "0 13px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-body)",
  background: "var(--surface-card)",
  width: "100%",
};
const chipTag: CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-body)",
  background: "var(--surface-sunken)",
  border: "var(--border-width) solid var(--border-default)",
  borderRadius: "var(--radius)",
  padding: "3px 9px",
  whiteSpace: "nowrap",
};
const smallSecondary: CSSProperties = {
  height: 32,
  border: "var(--border-width) solid var(--border-default)",
  background: "var(--surface-card)",
  borderRadius: "var(--radius)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-base)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-secondary)",
  padding: "0 14px",
  cursor: "pointer",
};
