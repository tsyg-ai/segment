import { useMemo, useRef, useState, type CSSProperties } from "react";
import { nl } from "@/i18n";
import { isAppError } from "@/lib/ipc";
import { useOutsideClick } from "@/lib/useOutsideClick";
import type {
  AttributeDefinition,
  AttributeInput,
  AttributeOption,
  AttributeType,
} from "@/lib/beheerTypes";
import {
  useAttributes,
  useAttributeMutations,
  useTemplates,
} from "@/lib/beheerQueries";
import {
  BeheerColumns,
  BeheerHeader,
  BeheerLayout,
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
import {
  AttributeTypeFields,
  type AttributeTypeValues,
} from "@/components/beheer/AttributeTypeFields";
import { Modal } from "@/components/overlays/Modal";
import { Dialog } from "@/components/overlays/Dialog";
import { Icon } from "@/components/core/Icon";
import { SectionLabel } from "@/components/display/SectionLabel";

const TYPE_ORDER: AttributeType[] = ["select", "text", "number", "date", "checkbox"];

export function typeSummary(a: AttributeDefinition): string {
  if (a.type === "select") {
    return nl.attributes.optionSummary(a.selectMultiple, a.options.length);
  }
  return nl.attributes.types[a.type];
}

function optionPreview(a: AttributeDefinition): string {
  if (a.type === "select") return a.options.map((o) => o.label).join(" · ");
  if (a.type === "text")
    return a.textMultiline ? "Vrije tekst, meerdere lijnen" : "Vrije tekst, één lijn";
  if (a.type === "number")
    return `Getal${a.numberUnit ? `, eenheid ${a.numberUnit}` : ""}`;
  if (a.type === "date") return "Datum, uur optioneel";
  return a.checkboxDefault ? "Standaard aangevinkt" : "Aangevinkt of leeg";
}

const emptyTypeValues: AttributeTypeValues = {
  selectMultiple: false,
  textMultiline: false,
  numberUnit: "",
  checkboxDefault: false,
};

export type OptionDialog =
  | { kind: "rename"; option: AttributeOption; attr: AttributeDefinition }
  | { kind: "delete"; option: AttributeOption; attr: AttributeDefinition }
  | null;

export function AttributesPage() {
  const { data: attributes = [], isLoading, isError } = useAttributes();
  const { data: templates = [] } = useTemplates();
  const m = useAttributeMutations();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [optionDialog, setOptionDialog] = useState<OptionDialog>(null);
  const [scopeSwitch, setScopeSwitch] = useState<AttributeDefinition | null>(null);
  const [deleting, setDeleting] = useState<AttributeDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => attributes.find((a) => a.id === selectedId) ?? null,
    [attributes, selectedId],
  );
  const global = attributes.filter((a) => a.scope === "global");
  const project = attributes.filter((a) => a.scope === "project");

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

  return (
    <BeheerLayout>
      <BeheerHeader
        title={nl.attributes.title}
        count={nl.attributes.count(attributes.length)}
        intro={nl.attributes.intro}
        primaryLabel={nl.attributes.newAttribute}
        onPrimary={() => setCreating(true)}
      />

      <BeheerColumns
        panel={
          selected ? (
            <AttributeDetail
              key={selected.id}
              attr={selected}
              templateName={
                templates.find((t) => t.id === selected.templateId)?.name ?? "—"
              }
              onClose={() => setSelectedId(null)}
              onRename={(name) =>
                void run(
                  m.update.mutateAsync({
                    id: selected.id,
                    input: toInput(selected, { name }),
                  }),
                )
              }
              onSetting={(patch) =>
                void run(
                  m.update.mutateAsync({
                    id: selected.id,
                    input: toInput(selected, patch),
                  }),
                )
              }
              onAddOption={(label) =>
                void run(m.addOption.mutateAsync({ attributeId: selected.id, label }))
              }
              onReorderOptions={(ids) =>
                void run(
                  m.reorderOptions.mutateAsync({ attributeId: selected.id, ids }),
                )
              }
              onOptionMenu={(option, kind) =>
                setOptionDialog({ kind, option, attr: selected })
              }
              onSwitchScope={() => setScopeSwitch(selected)}
              onDelete={() => setDeleting(selected)}
            />
          ) : undefined
        }
      >
        {error ? <ErrorBanner message={error} /> : null}
        {isLoading ? (
          <p style={mutedP}>{nl.beheer.loading}</p>
        ) : isError ? (
          <p style={mutedP}>{nl.beheer.loadError}</p>
        ) : attributes.length === 0 ? (
          <OnboardingEmptyState
            step="optional"
            title={nl.onboarding.attributes.title}
            body={nl.onboarding.attributes.body}
            actionLabel={nl.onboarding.attributes.action}
            onAction={() => setCreating(true)}
            hint={nl.onboarding.attributes.hint}
          />
        ) : (
          <>
            <AttrGroup
              label={nl.attributes.groupGlobal}
              hint={nl.attributes.groupGlobalHint}
              attrs={global}
              selectedId={selectedId}
              onOpen={setSelectedId}
            />
            <AttrGroup
              label={nl.attributes.groupProject}
              hint={nl.attributes.groupProjectHint}
              attrs={project}
              selectedId={selectedId}
              onOpen={setSelectedId}
              templateName={(id) => templates.find((t) => t.id === id)?.name}
            />
          </>
        )}
      </BeheerColumns>

      {creating ? (
        <NewAttributeModal
          templates={[]}
          lockGlobal
          pending={m.create.isPending}
          onClose={() => setCreating(false)}
          onSubmit={async (input, options) => {
            const ok = await run(
              (async () => {
                const created = await m.create.mutateAsync(input);
                for (const label of options) {
                  await m.addOption.mutateAsync({ attributeId: created.id, label });
                }
              })(),
            );
            if (ok) setCreating(false);
          }}
        />
      ) : null}

      {optionDialog?.kind === "rename" ? (
        <RenameOptionDialog
          dialog={optionDialog}
          onClose={() => setOptionDialog(null)}
          onConfirm={async (newLabel, applyToExisting) => {
            const ok = await run(
              m.renameOption.mutateAsync({
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
              m.removeOption.mutateAsync({
                optionId: optionDialog.option.id,
                clearValues,
                attributeId: optionDialog.attr.id,
              }),
            );
            if (ok) setOptionDialog(null);
          }}
        />
      ) : null}

      {scopeSwitch ? (
        <Dialog
          title={nl.attributes.scopeSwitchTitle(scopeSwitch.name)}
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
              m.setScope.mutateAsync({ id: scopeSwitch.id, scope: "global" }),
            );
            if (ok) setScopeSwitch(null);
          }}
          onCancel={() => setScopeSwitch(null)}
        />
      ) : null}

      {deleting ? (
        <Dialog
          title={nl.attributes.deleteAttributeTitle(deleting.name)}
          description={nl.attributes.deleteAttributeBody(deleting.valueCount)}
          confirmLabel={nl.beheer.delete}
          confirmVariant="danger"
          onConfirm={async () => {
            const ok = await run(m.remove.mutateAsync(deleting.id));
            if (ok) {
              setDeleting(null);
              if (selectedId === deleting.id) setSelectedId(null);
            }
          }}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </BeheerLayout>
  );
}

function toInput(
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

const mutedP: CSSProperties = {
  margin: 0,
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-medium)",
  color: "var(--text-secondary)",
};

function ErrorBanner({ message }: { message: string }) {
  return (
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
      {message}
    </div>
  );
}

function AttrGroup({
  label,
  hint,
  attrs,
  selectedId,
  onOpen,
  templateName,
}: {
  label: string;
  hint: string;
  attrs: AttributeDefinition[];
  selectedId: number | null;
  onOpen: (id: number) => void;
  templateName?: (id: number | null) => string | undefined;
}) {
  if (attrs.length === 0) return null;
  const sorted = [...attrs].sort(
    (a, b) =>
      TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
      a.name.localeCompare(b.name),
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <GroupLabel label={label} hint={hint} />
      <ListCard>
        {sorted.map((a, i) => (
          <div
            key={a.id}
            onClick={() => onOpen(a.id)}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) 220px",
              gap: "var(--space-8)",
              alignItems: "center",
              padding: "12px 18px",
              borderBottom:
                i < sorted.length - 1
                  ? "var(--border-width) solid var(--border-subtle)"
                  : "none",
              background:
                a.id === selectedId ? "var(--surface-row-selected)" : "transparent",
              cursor: "pointer",
            }}
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-4)",
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-lg)",
                    fontWeight: "var(--weight-black)",
                    letterSpacing: "-0.2px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {a.name}
                </span>
                {templateName ? (
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      fontWeight: "var(--weight-bold)",
                      color: "var(--text-body)",
                      background: "var(--surface-sunken)",
                      border: "var(--border-width) solid var(--border-default)",
                      borderRadius: "var(--radius)",
                      padding: "3px 9px",
                      whiteSpace: "nowrap",
                      flex: "none",
                    }}
                  >
                    {templateName(a.templateId) ?? "—"}
                  </span>
                ) : null}
              </span>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--weight-bold)",
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {optionPreview(a)}
              </span>
            </div>
            <span
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: "var(--weight-bold)",
                color: "var(--text-body)",
              }}
            >
              {typeSummary(a)}
            </span>
          </div>
        ))}
      </ListCard>
    </div>
  );
}

// --------------------------------------------------------------- new modal

export function NewAttributeModal({
  templates,
  pending,
  onClose,
  onSubmit,
  lockedTemplateId = null,
  lockGlobal = false,
}: {
  templates: { id: number; name: string }[];
  pending: boolean;
  onClose: () => void;
  /** `options` are the cleaned keuzelijst-opties; the caller creates the kenmerk
   *  and then adds each option (create_attribute never takes options itself). */
  onSubmit: (input: AttributeInput, options: string[]) => void;
  /** When set, the kenmerk is fixed to this sjabloon and the bereik-keuze is hidden. */
  lockedTemplateId?: number | null;
  /** When true, the kenmerk is fixed to `algemeen` (global) and the bereik-keuze
   *  is hidden — sjabloon-scope kenmerken are only added from the sjabloon-editor. */
  lockGlobal?: boolean;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AttributeType>("select");
  const [tv, setTv] = useState<AttributeTypeValues>(emptyTypeValues);
  const [options, setOptions] = useState<string[]>([""]);
  const [scope, setScope] = useState<"global" | "project">(
    lockedTemplateId != null ? "project" : "global",
  );
  const [templateId, setTemplateId] = useState<number | null>(
    lockedTemplateId ?? templates[0]?.id ?? null,
  );
  const scopeLocked = lockGlobal || lockedTemplateId != null;

  const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
  const valid =
    name.trim() !== "" &&
    (type !== "select" || cleanOptions.length >= 1) &&
    (scope === "global" || templateId != null);

  const submit = () => {
    if (!valid) return;
    onSubmit(
      {
        name: name.trim(),
        type,
        scope,
        templateId: scope === "project" ? templateId : null,
        selectMultiple: tv.selectMultiple,
        textMultiline: tv.textMultiline,
        numberUnit: tv.numberUnit.trim() || null,
        checkboxDefault: tv.checkboxDefault,
      },
      cleanOptions,
    );
  };

  return (
    <Modal
      title={nl.attributes.newAttribute}
      description={nl.attributes.newHelp}
      confirmLabel={nl.attributes.newAttribute}
      confirmDisabled={!valid || pending}
      onConfirm={submit}
      onClose={onClose}
      footerNote={scope === "global" ? nl.attributes.appearsEmpty : undefined}
    >
      <Group label={nl.beheer.name}>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="bv. Fase HGD"
          style={textInput}
        />
      </Group>

      <Group label={nl.attributes.typeLabel}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "var(--space-4)",
          }}
        >
          {TYPE_ORDER.map((t) => {
            const active = t === type;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={active}
                onClick={() => setType(t)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 4,
                  padding: "11px 12px",
                  borderRadius: "var(--radius)",
                  cursor: "pointer",
                  textAlign: "left",
                  background: active ? "var(--accent-tint)" : "var(--surface-card)",
                  border: active
                    ? "var(--border-width) solid var(--accent)"
                    : "var(--border-width) solid var(--border-default)",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-base)",
                    fontWeight: "var(--weight-black)",
                    color: active ? "var(--accent-text)" : "var(--text-primary)",
                  }}
                >
                  {nl.attributes.types[t]}
                </span>
                <span
                  style={{
                    fontSize: "11.5px",
                    fontWeight: "var(--weight-bold)",
                    color: "var(--text-muted)",
                    lineHeight: 1.35,
                  }}
                >
                  {nl.attributes.typeHints[t]}
                </span>
              </button>
            );
          })}
        </div>
      </Group>

      <AttributeTypeFields
        type={type}
        values={tv}
        onChange={(p) => setTv((v) => ({ ...v, ...p }))}
      />

      {type === "select" ? (
        <Group label={nl.attributes.optionsLabel}>
          <ListCard>
            {options.map((opt, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) 28px",
                  gap: "var(--space-5)",
                  alignItems: "center",
                  padding: "10px 13px",
                  borderBottom:
                    i < options.length - 1
                      ? "var(--border-width) solid var(--border-subtle)"
                      : "none",
                }}
              >
                <input
                  value={opt}
                  onChange={(e) =>
                    setOptions((os) => os.map((o, j) => (j === i ? e.target.value : o)))
                  }
                  placeholder={`Optie ${i + 1}`}
                  aria-label={`Optie ${i + 1}`}
                  style={{
                    ...textInput,
                    height: 30,
                    border: 0,
                    background: "transparent",
                    padding: 0,
                  }}
                />
                <button
                  type="button"
                  aria-label="Optie verwijderen"
                  onClick={() => setOptions((os) => os.filter((_, j) => j !== i))}
                  style={{
                    width: 28,
                    height: 28,
                    border: 0,
                    background: "transparent",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
          </ListCard>
          <button
            type="button"
            onClick={() => setOptions((os) => [...os, ""])}
            style={smallSecondary}
          >
            {nl.attributes.addOption}
          </button>
        </Group>
      ) : null}

      {scopeLocked ? null : (
        <Group label={nl.attributes.scopeLabel}>
          <div
            style={{
              display: "flex",
              gap: "var(--space-4)",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              aria-pressed={scope === "global"}
              onClick={() => setScope("global")}
              style={scope === "global" ? pillActive : pill}
            >
              {nl.attributes.scopeGlobal}
            </button>
            <button
              type="button"
              aria-pressed={scope === "project"}
              onClick={() => setScope("project")}
              disabled={templates.length === 0}
              style={scope === "project" ? pillActive : pill}
            >
              {nl.attributes.scopeProject}
            </button>
            {scope === "project" ? (
              <select
                aria-label={nl.attributes.scopeProject}
                value={templateId ?? ""}
                onChange={(e) => setTemplateId(Number(e.target.value) || null)}
                style={{ ...textInput, width: "auto" }}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <span style={helpText}>
            {scope === "global"
              ? nl.attributes.globalNote
              : "Enkel bruikbaar bij taken uit projecten van dit sjabloon."}
          </span>
        </Group>
      )}
    </Modal>
  );
}

// ------------------------------------------------------------------ detail

export function AttributeDetail({
  attr,
  templateName,
  onClose,
  onRename,
  onSetting,
  onAddOption,
  onReorderOptions,
  onOptionMenu,
  onSwitchScope,
  onDelete,
}: {
  attr: AttributeDefinition;
  templateName: string;
  onClose: () => void;
  onRename: (name: string) => void;
  onSetting: (patch: Partial<AttributeInput>) => void;
  onAddOption: (label: string) => void;
  onReorderOptions: (ids: number[]) => void;
  onOptionMenu: (option: AttributeOption, kind: "rename" | "delete") => void;
  onSwitchScope: () => void;
  onDelete: () => void;
}) {
  const [newOption, setNewOption] = useState("");
  const tv: AttributeTypeValues = {
    selectMultiple: attr.selectMultiple,
    textMultiline: attr.textMultiline,
    numberUnit: attr.numberUnit ?? "",
    checkboxDefault: attr.checkboxDefault,
  };

  return (
    <DetailPanel
      kicker={nl.attributes.title.slice(0, -1)}
      title={<EditableTitle value={attr.name} onCommit={onRename} />}
      subtitle={`${nl.attributes.valueCount(attr.valueCount)} · filterbaar in alle views`}
      onClose={onClose}
    >
      <Group label={nl.attributes.settingLabel}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "9px 14px",
            alignItems: "center",
          }}
        >
          <span style={settingKey}>{nl.attributes.typeLabel}</span>
          <span style={settingVal}>{nl.attributes.types[attr.type]}</span>
          <span style={settingKey}>{nl.attributes.scopeLabel}</span>
          <span style={settingVal}>
            {attr.scope === "global" ? nl.attributes.scopeGlobal : templateName}
            {attr.scope === "project" ? (
              <button type="button" onClick={onSwitchScope} style={linkBtn}>
                → global maken
              </button>
            ) : null}
          </span>
        </div>
        <span style={helpText}>{nl.attributes.typeReadonly}</span>
      </Group>

      <Group label="Instelvelden">
        <AttributeTypeFields
          type={attr.type}
          values={tv}
          onChange={(p) => {
            const patch: Partial<AttributeInput> = {};
            if ("selectMultiple" in p) patch.selectMultiple = p.selectMultiple;
            if ("textMultiline" in p) patch.textMultiline = p.textMultiline;
            if ("numberUnit" in p)
              patch.numberUnit = (p.numberUnit ?? "").trim() || null;
            if ("checkboxDefault" in p) patch.checkboxDefault = p.checkboxDefault;
            onSetting(patch);
          }}
        />
      </Group>

      {attr.type === "select" ? (
        <Group label={nl.attributes.optionsLabel} hint={nl.beheer.dragToReorder}>
          <ListCard>
            <SortableList items={attr.options} onReorder={onReorderOptions}>
              {(o, handle) => (
                <OptionRow
                  option={o}
                  handle={handle}
                  onMenu={(k) => onOptionMenu(o, k)}
                />
              )}
            </SortableList>
          </ListCard>
          <div style={{ display: "flex", gap: "var(--space-4)" }}>
            <input
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newOption.trim()) {
                  onAddOption(newOption.trim());
                  setNewOption("");
                }
              }}
              placeholder="Nieuwe optie"
              aria-label="Nieuwe optie"
              style={{ ...textInput, height: 32 }}
            />
            <button
              type="button"
              onClick={() => {
                if (newOption.trim()) {
                  onAddOption(newOption.trim());
                  setNewOption("");
                }
              }}
              style={smallSecondary}
            >
              {nl.attributes.addOption}
            </button>
          </div>
        </Group>
      ) : null}

      <Group label={nl.attributes.usedInLabel}>
        <span
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: "var(--weight-semibold)",
            color: "var(--text-body)",
            lineHeight: "var(--leading-snug)",
          }}
        >
          {nl.attributes.valueCount(attr.valueCount)}.
        </span>
        <DangerLink label={nl.attributes.deleteAttribute} onClick={onDelete} />
        <span style={helpText}>
          {nl.attributes.deleteAttributeBody(attr.valueCount)}
        </span>
      </Group>
    </DetailPanel>
  );
}

function EditableTitle({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft.trim() && draft.trim() !== value) onCommit(draft.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        style={{
          ...textInput,
          fontSize: "var(--text-2xl)",
          fontWeight: "var(--weight-black)",
        }}
      />
    );
  }
  return (
    <span
      style={{
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-4)",
      }}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
    >
      {value}
      <Icon name="pencil" size={15} style={{ color: "var(--text-muted)" }} />
    </span>
  );
}

function OptionRow({
  option,
  handle,
  onMenu,
}: {
  option: AttributeOption;
  handle: SortableHandleProps;
  onMenu: (kind: "rename" | "delete") => void;
}) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  useOutsideClick(open, rowRef, () => setOpen(false));
  return (
    <div
      ref={rowRef}
      style={{
        display: "grid",
        gridTemplateColumns: "18px minmax(0,1fr) auto 28px",
        gap: "var(--space-5)",
        alignItems: "center",
        padding: "10px 13px",
        borderBottom: "var(--border-width) solid var(--border-subtle)",
        position: "relative",
      }}
    >
      <span
        ref={handle.ref}
        {...handle.attributes}
        {...handle.listeners}
        style={{
          cursor: "grab",
          color: "var(--text-label)",
          fontSize: "var(--text-sm)",
          fontWeight: "var(--weight-black)",
        }}
        title={nl.beheer.dragToReorder}
      >
        ⠿
      </span>
      <span
        style={{
          fontSize: "var(--text-base)",
          fontWeight: "var(--weight-bold)",
          color: "var(--text-body)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {option.label}
      </span>
      <span
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: "var(--weight-bold)",
          color: "var(--text-muted)",
        }}
      >
        {option.valueCount} taken
      </span>
      <button
        type="button"
        aria-label="Optiemenu"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 28,
          height: 28,
          border: 0,
          background: "transparent",
          borderRadius: "var(--radius-sm)",
          color: "var(--text-label)",
          cursor: "pointer",
        }}
      >
        <Icon name="ellipsis" size={13} />
      </button>
      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 8,
            top: 36,
            zIndex: 5,
            background: "var(--surface-card)",
            border: "var(--border-width) solid var(--border-default)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-popover)",
            padding: 4,
            display: "flex",
            flexDirection: "column",
            minWidth: 140,
          }}
        >
          {(["rename", "delete"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onMenu(k);
              }}
              style={{
                border: 0,
                background: "transparent",
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-sm)",
                fontWeight: "var(--weight-bold)",
                color: k === "delete" ? "var(--late-fg)" : "var(--text-body)",
                cursor: "pointer",
              }}
            >
              {k === "rename" ? "Hernoemen" : "Verwijderen"}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------- option dialogs

export function RenameOptionDialog({
  dialog,
  onClose,
  onConfirm,
}: {
  dialog: { option: AttributeOption; attr: AttributeDefinition };
  onClose: () => void;
  onConfirm: (newLabel: string, applyToExisting: boolean) => void;
}) {
  const [label, setLabel] = useState(dialog.option.label);
  const [apply, setApply] = useState(true);
  const n = dialog.option.valueCount;
  return (
    <Dialog
      title={nl.attributes.renameOptionTitle}
      description={nl.attributes.renameOptionBody(
        dialog.option.label,
        label.trim() || "…",
        dialog.attr.name,
        n,
      )}
      confirmLabel={nl.attributes.renameVerb}
      confirmDisabled={!label.trim()}
      onConfirm={() => onConfirm(label.trim(), apply)}
      onCancel={onClose}
      note={
        n === 0 ? undefined : "Dezelfde vraag komt bij het verwijderen van een optie."
      }
    >
      <Group label={nl.beheer.name}>
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={textInput}
        />
      </Group>
      {n > 0 ? (
        <Group label={nl.attributes.renameApplyLabel}>
          <RadioRow
            checked={apply}
            title={nl.attributes.renameApplyYes(n)}
            help={nl.attributes.renameApplyYesHelp(label.trim() || "…")}
            onSelect={() => setApply(true)}
          />
          <RadioRow
            checked={!apply}
            title={nl.attributes.renameApplyNo(dialog.option.label)}
            help={nl.attributes.renameApplyNoHelp}
            onSelect={() => setApply(false)}
          />
        </Group>
      ) : null}
    </Dialog>
  );
}

export function DeleteOptionDialog({
  dialog,
  onClose,
  onConfirm,
}: {
  dialog: { option: AttributeOption; attr: AttributeDefinition };
  onClose: () => void;
  onConfirm: (clearValues: boolean) => void;
}) {
  const [clear, setClear] = useState(false);
  const n = dialog.option.valueCount;
  return (
    <Dialog
      title={nl.attributes.deleteOptionTitle}
      description={nl.attributes.deleteOptionBody(
        dialog.option.label,
        dialog.attr.name,
        n,
      )}
      confirmLabel={nl.attributes.deleteOptionVerb}
      confirmVariant="danger"
      onConfirm={() => onConfirm(clear)}
      onCancel={onClose}
    >
      {n > 0 ? (
        <Group label={nl.attributes.renameApplyLabel}>
          <RadioRow
            checked={!clear}
            title={nl.attributes.deleteOptionClearNo}
            help={nl.attributes.renameApplyNoHelp}
            onSelect={() => setClear(false)}
          />
          <RadioRow
            checked={clear}
            title={nl.attributes.deleteOptionClearYes(n)}
            help="De waarde verdwijnt volledig bij die taken."
            onSelect={() => setClear(true)}
          />
        </Group>
      ) : null}
    </Dialog>
  );
}

function RadioRow({
  checked,
  title,
  help,
  onSelect,
}: {
  checked: boolean;
  title: string;
  help: string;
  onSelect: () => void;
}) {
  return (
    <label
      onClick={onSelect}
      style={{
        display: "grid",
        gridTemplateColumns: "22px minmax(0,1fr)",
        gap: "var(--space-5)",
        alignItems: "start",
        cursor: "pointer",
        background: checked ? "var(--surface-row-selected)" : "var(--surface-card)",
        border: checked
          ? "var(--border-width) solid var(--accent)"
          : "var(--border-width) solid var(--border-default)",
        borderRadius: "var(--radius)",
        padding: "13px 15px",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "var(--radius-round)",
          background: checked ? "var(--accent)" : "transparent",
          border: checked ? 0 : "2px solid var(--border-hover)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
        }}
      >
        {checked ? (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "var(--radius-round)",
              background: "var(--text-on-dark)",
            }}
          />
        ) : null}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: "var(--text-md)", fontWeight: "var(--weight-black)" }}>
          {title}
        </span>
        <span style={helpText}>{help}</span>
      </span>
    </label>
  );
}

// ------------------------------------------------------------------ shared

function Group({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        <SectionLabel>{label}</SectionLabel>
        {hint ? (
          <span
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: "var(--weight-bold)",
              color: "var(--text-label)",
            }}
          >
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

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

const helpText: CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: "var(--weight-semibold)",
  color: "var(--text-muted)",
  lineHeight: "var(--leading-snug)",
};

const settingKey: CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: "var(--weight-semibold)",
  color: "var(--text-muted)",
};
const settingVal: CSSProperties = {
  fontSize: "var(--text-base)",
  fontWeight: "var(--weight-bold)",
  justifySelf: "start",
  display: "flex",
  alignItems: "center",
  gap: "var(--space-4)",
};

const linkBtn: CSSProperties = {
  border: 0,
  background: "transparent",
  color: "var(--text-link)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-xs)",
  fontWeight: "var(--weight-bold)",
  cursor: "pointer",
  padding: 0,
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
  flex: "none",
};

const pill: CSSProperties = {
  height: 38,
  padding: "0 15px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-base)",
  fontWeight: "var(--weight-bold)",
  borderRadius: "var(--radius)",
  cursor: "pointer",
  background: "var(--surface-card)",
  color: "var(--text-body)",
  border: "var(--border-width) solid var(--border-default)",
};
const pillActive: CSSProperties = {
  ...pill,
  fontWeight: "var(--weight-black)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
  border: "var(--border-width) solid var(--accent)",
};
