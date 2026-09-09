import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { z } from "zod";
import { nl } from "@/i18n";
import type { Status } from "@/lib/statusTypes";
import type {
  ReminderAnchor,
  ReminderBasis,
  ReminderDefinition,
  ReminderDirection,
  ReminderMode,
  ReminderUnit,
} from "@/lib/beheerTypes";
import { Button } from "@/components/core/Button";
import { SectionLabel } from "@/components/display/SectionLabel";
import { DateField } from "@/components/forms/DateField";
import { TimeField } from "@/components/forms/TimeField";

/**
 * The zin-vormige herinnering builder (spec §1.1, §6.2). It is the one place
 * the segmented control appears. Output is a herinnering **definitie** —
 * `mode` + the relevant fields — and never a resolved `fire_at`.
 *
 * Rules the sentence enforces:
 *   - "vóór" only exists with a deadline basis; a status basis pins the
 *     direction to "ná";
 *   - a tijdstip only shows for day-offsets;
 *   - "vorige taak" / "volgende taak" only within a project (`allowSiblings`).
 *
 * Reused by the sjabloontaak-editor, snel-toevoegen + taakdetail
 * and a read-only calendar/dashboard view.
 */
export interface ReminderPopoverProps {
  statuses: Status[];
  /** Show the "vorige taak" / "volgende taak" anchors (project context). */
  allowSiblings?: boolean;
  /**
   * "template" replaces the concrete fire-moment line with "wordt per project
   * berekend" for relative reminders (spec §3).
   */
  context?: "template" | "task";
  initial?: ReminderDefinition;
  onSubmit: (definition: ReminderDefinition) => void;
  onCancel: () => void;
  /** Submit button copy — "Toevoegen" (new) or "Bewaren" (edit). */
  submitLabel?: string;
}

const absoluteSchema = z.object({
  mode: z.literal("absolute"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Kies een datum."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Kies een tijd."),
});

const relativeSchema = z
  .object({
    mode: z.literal("relative"),
    anchor: z.enum(["this_todo", "previous_todo", "next_todo"]),
    basis: z.enum(["deadline", "status"]),
    triggerStatusId: z.number().int().nullable(),
    offsetValue: z.number().int().positive("Geef een positief getal."),
    offsetUnit: z.enum(["days", "hours"]),
    offsetDirection: z.enum(["before", "after"]),
    fireTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.basis === "status" && v.triggerStatusId == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["triggerStatusId"],
        message: "Kies een status.",
      });
    }
    if (v.basis === "status" && v.offsetDirection === "before") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["offsetDirection"],
        message: nl.reminders.beforeOnlyDeadline,
      });
    }
  });

export const reminderFormSchema = z.union([absoluteSchema, relativeSchema]);

interface FormState {
  mode: ReminderMode;
  date: string;
  time: string;
  anchor: ReminderAnchor;
  basis: ReminderBasis;
  triggerStatusId: number | null;
  offsetValue: number;
  offsetUnit: ReminderUnit;
  offsetDirection: ReminderDirection;
  fireTime: string;
}

/** Local `YYYY-MM-DD` for today — the default so the date field never shows
 * its (light) native placeholder. */
function todayLiteral(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

function fromInitial(
  initial: ReminderDefinition | undefined,
  fallbackStatusId: number | null,
): FormState {
  if (!initial) {
    return {
      mode: "relative",
      date: todayLiteral(),
      time: "09:00",
      anchor: "this_todo",
      basis: "deadline",
      triggerStatusId: fallbackStatusId,
      offsetValue: 1,
      offsetUnit: "days",
      offsetDirection: "before",
      fireTime: "09:00",
    };
  }
  const [d, t] = (initial.fireAtLiteral ?? "").split(" ");
  return {
    mode: initial.mode,
    date: d || todayLiteral(),
    time: (t ?? "09:00").slice(0, 5),
    anchor: initial.anchor ?? "this_todo",
    basis: initial.basis ?? "deadline",
    triggerStatusId: initial.triggerStatusId ?? fallbackStatusId,
    offsetValue: initial.offsetValue ?? 1,
    offsetUnit: initial.offsetUnit ?? "days",
    offsetDirection: initial.offsetDirection ?? "before",
    fireTime: (initial.fireTime ?? "09:00").slice(0, 5),
  };
}

/** Build the DTO the core stores — never a fire_at. */
export function toDefinition(s: FormState): ReminderDefinition {
  if (s.mode === "absolute") {
    return { mode: "absolute", fireAtLiteral: `${s.date} ${s.time}:00` };
  }
  const statusBasis = s.basis === "status";
  return {
    mode: "relative",
    anchor: s.anchor,
    basis: s.basis,
    triggerStatusId: statusBasis ? s.triggerStatusId : null,
    offsetValue: s.offsetValue,
    offsetUnit: s.offsetUnit,
    // a status basis always fires "ná"
    offsetDirection: statusBasis ? "after" : s.offsetDirection,
    fireTime: s.offsetUnit === "days" ? s.fireTime : null,
  };
}

const chip: CSSProperties = {
  height: 32,
  border: "var(--border-width) solid var(--border-default)",
  background: "var(--surface-panel)",
  borderRadius: "var(--radius)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-md)",
  fontWeight: "var(--weight-black)",
  color: "var(--text-primary)",
  padding: "0 11px",
  cursor: "pointer",
};

const chipMeaning: CSSProperties = {
  ...chip,
  border: "var(--border-width) solid var(--accent-tint-border)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
};

function Segmented({
  value,
  onChange,
}: {
  value: ReminderMode;
  onChange: (m: ReminderMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Soort herinnering"
      style={{
        display: "flex",
        gap: 4,
        background: "var(--surface-sunken)",
        border: "var(--border-width) solid var(--border-default)",
        borderRadius: "var(--radius)",
        padding: 3,
      }}
    >
      {(["relative", "absolute"] as const).map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m)}
            style={{
              flex: 1,
              height: 30,
              border: 0,
              borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--weight-black)",
              cursor: "pointer",
              background: active ? "var(--surface-card)" : "transparent",
              color: active ? "var(--text-primary)" : "var(--text-muted)",
              boxShadow: active ? "var(--shadow-raised)" : "none",
            }}
          >
            {m === "relative" ? nl.reminders.modeRelative : nl.reminders.modeFixed}
          </button>
        );
      })}
    </div>
  );
}

export function ReminderPopover({
  statuses,
  allowSiblings = false,
  context = "task",
  initial,
  onSubmit,
  onCancel,
  submitLabel = nl.reminders.add,
}: ReminderPopoverProps) {
  const fallbackStatus = statuses[0]?.id ?? null;
  const [s, setS] = useState<FormState>(() => fromInitial(initial, fallbackStatus));
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const statusBasis = s.basis === "status";
  const dayOffset = s.offsetUnit === "days";
  const effectiveDirection: ReminderDirection = statusBasis
    ? "after"
    : s.offsetDirection;

  const parsed = useMemo(() => {
    const candidate =
      s.mode === "absolute"
        ? { mode: "absolute" as const, date: s.date, time: s.time }
        : {
            mode: "relative" as const,
            anchor: s.anchor,
            basis: s.basis,
            triggerStatusId: statusBasis ? s.triggerStatusId : null,
            offsetValue: s.offsetValue,
            offsetUnit: s.offsetUnit,
            offsetDirection: effectiveDirection,
            fireTime: dayOffset ? s.fireTime : null,
          };
    return reminderFormSchema.safeParse(candidate);
  }, [s, statusBasis, dayOffset, effectiveDirection]);

  const submit = () => {
    if (parsed.success) onSubmit(toDefinition(s));
  };

  return (
    <div
      role="dialog"
      aria-label={initial ? nl.reminders.save : nl.reminders.newReminder}
      style={{
        width: 436,
        maxWidth: "100%",
        background: "var(--surface-card)",
        border: "var(--border-width) solid var(--border-window)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-popover)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px 12px",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-5)",
          borderBottom: "var(--border-width) solid var(--border-subtle)",
        }}
      >
        <SectionLabel>
          {initial ? nl.reminders.save : nl.reminders.newReminder}
        </SectionLabel>
      </div>

      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-7)",
        }}
      >
        <Segmented value={s.mode} onChange={(m) => set("mode", m)} />

        {s.mode === "absolute" ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 7,
              fontSize: "var(--text-base)",
              fontWeight: "var(--weight-bold)",
              color: "var(--text-body)",
              lineHeight: 2,
            }}
          >
            <span>{nl.reminders.remindMeOn}</span>
            <DateField
              aria-label="Datum"
              value={s.date}
              onChange={(iso) => set("date", iso)}
              style={{ ...chipMeaning, padding: "0 9px" }}
            />
            <span>{nl.reminders.at}</span>
            <TimeField
              aria-label="Tijd"
              value={s.time}
              onChange={(t) => set("time", t)}
              style={{ ...chip, width: 90, textAlign: "center" }}
            />
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 7,
              fontSize: "var(--text-base)",
              fontWeight: "var(--weight-bold)",
              color: "var(--text-body)",
              lineHeight: 2,
            }}
          >
            <span>{nl.reminders.remindMe}</span>
            <input
              type="number"
              min={1}
              aria-label="Aantal"
              value={s.offsetValue}
              onChange={(e) =>
                set("offsetValue", Math.max(1, Number(e.target.value) || 1))
              }
              style={{ ...chip, width: 52, textAlign: "center" }}
            />
            <select
              aria-label="Eenheid"
              value={s.offsetUnit}
              onChange={(e) => set("offsetUnit", e.target.value as ReminderUnit)}
              style={chip}
            >
              <option value="days">
                {s.offsetValue === 1 ? nl.reminders.day : nl.reminders.days}
              </option>
              <option value="hours">
                {s.offsetValue === 1 ? nl.reminders.hour : nl.reminders.hours}
              </option>
            </select>

            {statusBasis ? (
              <span
                aria-label="Richting"
                style={{
                  ...chip,
                  cursor: "default",
                  background: "var(--surface-sunken)",
                  color: "var(--text-secondary)",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                {nl.reminders.after}
              </span>
            ) : (
              <select
                aria-label="Richting"
                value={s.offsetDirection}
                onChange={(e) =>
                  set("offsetDirection", e.target.value as ReminderDirection)
                }
                style={chip}
              >
                <option value="before">{nl.reminders.before}</option>
                <option value="after">{nl.reminders.after}</option>
              </select>
            )}

            <select
              aria-label="Basis"
              value={s.basis}
              onChange={(e) => set("basis", e.target.value as ReminderBasis)}
              style={chipMeaning}
            >
              <option value="deadline">{nl.reminders.deadline}</option>
              <option value="status">{nl.reminders.statusWord}</option>
            </select>

            <span>{nl.reminders.of}</span>

            <select
              aria-label="Anker"
              value={s.anchor}
              onChange={(e) => set("anchor", e.target.value as ReminderAnchor)}
              style={chipMeaning}
            >
              <option value="this_todo">{nl.reminders.anchorThis}</option>
              {allowSiblings ? (
                <>
                  <option value="previous_todo">{nl.reminders.anchorPrev}</option>
                  <option value="next_todo">{nl.reminders.anchorNext}</option>
                </>
              ) : null}
            </select>

            {dayOffset ? (
              <>
                <span>, {nl.reminders.at}</span>
                <TimeField
                  aria-label="Tijdstip"
                  value={s.fireTime}
                  onChange={(t) => set("fireTime", t)}
                  style={{ ...chip, width: 82, textAlign: "center" }}
                />
              </>
            ) : (
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: "var(--weight-semibold)",
                  color: "var(--text-muted)",
                }}
              >
                {nl.reminders.timeNa}
              </span>
            )}
          </div>
        )}

        {s.mode === "relative" && statusBasis ? (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-4)",
              background: "var(--surface-panel)",
              border: "var(--border-width) solid var(--border-default)",
              borderRadius: "var(--radius)",
              padding: 11,
            }}
          >
            <span
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: "var(--weight-bold)",
                color: "var(--text-secondary)",
                whiteSpace: "nowrap",
              }}
            >
              {nl.reminders.fromStatus}
            </span>
            <select
              aria-label={nl.reminders.fromStatus}
              value={s.triggerStatusId ?? ""}
              onChange={(e) => set("triggerStatusId", Number(e.target.value) || null)}
              style={{ ...chip, flex: 1 }}
            >
              {statuses.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <FireLine context={context} mode={s.mode} parsed={parsed.success} />

        {s.mode === "relative" && !allowSiblings ? (
          <Hint>{nl.reminders.relativeWithinProjectOnly}</Hint>
        ) : null}
        {s.mode === "relative" ? <Hint>{nl.reminders.beforeOnlyDeadline}</Hint> : null}
      </div>

      <div
        style={{
          padding: "12px 16px",
          borderTop: "var(--border-width) solid var(--border-subtle)",
          background: "var(--surface-panel)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-5)",
        }}
      >
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onCancel}>
          {nl.reminders.cancel}
        </Button>
        <Button onClick={submit} disabled={!parsed.success}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function FireLine({
  context,
  mode,
  parsed,
}: {
  context: "template" | "task";
  mode: ReminderMode;
  parsed: boolean;
}) {
  const perProject = context === "template" && mode === "relative";
  const text = perProject
    ? nl.reminders.perProjectLine
    : context === "template" && mode === "absolute"
      ? nl.reminders.absoluteInProject
      : parsed
        ? "Deze herinnering is klaar om toe te voegen."
        : "Vul de zin verder aan.";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-3)",
        background: "var(--today-bg)",
        border: "var(--border-width) solid var(--today-border)",
        borderRadius: "var(--radius)",
        padding: "10px 12px",
      }}
    >
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: "var(--radius-round)",
          background: "var(--today-fg)",
          flex: "none",
          marginTop: 5,
        }}
      />
      <span
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: "var(--weight-bold)",
          color: "var(--today-fg)",
          lineHeight: "var(--leading-snug)",
        }}
      >
        {text}
      </span>
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: "var(--text-xs)",
        fontWeight: "var(--weight-semibold)",
        color: "var(--text-muted)",
        lineHeight: "var(--leading-snug)",
      }}
    >
      {children}
    </span>
  );
}
