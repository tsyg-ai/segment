import { useMemo, useState, type CSSProperties } from "react";
import { Calendar, dateFnsLocalizer, Views, type View } from "react-big-calendar";
import {
  format as dfFormat,
  parse as dfParse,
  startOfWeek as dfStartOfWeek,
  getDay,
  startOfMonth,
  endOfMonth,
  endOfWeek,
  addMonths,
  addWeeks,
} from "date-fns";
import { nl as nlLocale } from "date-fns/locale";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendar.css";

import { nl } from "@/i18n";
import { formatFullDate, formatTime, parseLocalDateTime } from "@/i18n/format";
import { useViewState } from "@/store/useViewState";
import { useCalendarEvents } from "@/lib/dashboardQueries";
import type { CalendarEvent, CalendarTone } from "@/lib/dashboardTypes";
import { MetaChip } from "@/components/display/MetaChip";
import { Icon, type IconName } from "@/components/core/Icon";

const localizer = dateFnsLocalizer({
  format: dfFormat,
  parse: dfParse,
  startOfWeek: (date: Date) => dfStartOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { nl: nlLocale },
});

interface RbcEvent {
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: CalendarEvent;
}

const NO_EVENTS: CalendarEvent[] = [];

/**
 * De vierde takenview: **alleen-lezen** maand/week op
 * react-big-calendar, gethemed naar het ontwerp. Toont deadlines én
 * herinneringen, respecteert de gedeelde filter + zoekterm, sluit
 * gearchiveerde projecten uit. Een event aanklikken opent het taakdetailpaneel.
 */
export function CalendarView({ onOpen }: { onOpen: (todoId: number) => void }) {
  const filter = useViewState((s) => s.filter);
  const search = useViewState((s) => s.search);

  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState(() => new Date());
  const [dayPopover, setDayPopover] = useState<{
    date: Date;
    events: RbcEvent[];
  } | null>(null);

  const { from, to } = useMemo(() => visibleRange(date, view), [date, view]);

  const { data: rawEvents } = useCalendarEvents(from, to, filter, search);
  const events = rawEvents ?? NO_EVENTS;

  const rbcEvents: RbcEvent[] = useMemo(
    () =>
      events.map((e) => {
        const start = parseLocalDateTime(e.at);
        const end = e.allDay ? start : new Date(start.getTime() + 30 * 60_000);
        return { title: e.title, start, end, allDay: e.allDay, resource: e };
      }),
    [events],
  );

  const periodTitle =
    view === Views.MONTH
      ? dfFormat(date, "LLLL yyyy", { locale: nlLocale })
      : `${dfFormat(dfStartOfWeek(date, { weekStartsOn: 1 }), "d MMM", {
          locale: nlLocale,
        })} – ${dfFormat(endOfWeek(date, { weekStartsOn: 1 }), "d MMM", {
          locale: nlLocale,
        })}`;

  const step = (dir: -1 | 1) =>
    setDate((d) => (view === Views.MONTH ? addMonths(d, dir) : addWeeks(d, dir)));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
        flex: 1,
        minHeight: 0,
      }}
    >
      <div style={toolbar}>
        <button
          type="button"
          style={navBtn}
          aria-label={nl.calendar.back}
          onClick={() => step(-1)}
        >
          <Icon
            name="chevron-right"
            size={14}
            style={{ transform: "rotate(180deg)" }}
          />
        </button>
        <button
          type="button"
          style={navBtn}
          aria-label={nl.calendar.next}
          onClick={() => step(1)}
        >
          <Icon name="chevron-right" size={14} />
        </button>
        <button type="button" style={todayBtn} onClick={() => setDate(new Date())}>
          {nl.calendar.today}
        </button>
        <span style={period}>{periodTitle}</span>

        <div style={{ flex: 1 }} />

        <div style={legend}>
          <LegendItem
            tone="neutral"
            icon="calendar"
            label={nl.calendar.legendDeadline}
          />
          <LegendItem tone="done" icon="bell" label={nl.calendar.legendReminder} />
          <LegendItem tone="late" icon="circle-alert" label={nl.calendar.legendLate} />
        </div>

        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          {([Views.MONTH, Views.WEEK] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              style={toggleBtn(view === v)}
            >
              {v === Views.MONTH ? nl.calendar.month : nl.calendar.week}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 420 }}>
        <Calendar
          localizer={localizer}
          culture="nl"
          events={rbcEvents}
          view={view as View}
          date={date}
          onView={(v) => setView(v)}
          onNavigate={(d) => setDate(d)}
          views={[Views.MONTH, Views.WEEK]}
          toolbar={false}
          selectable={false}
          popup={false}
          longPressThreshold={1000}
          startAccessor="start"
          endAccessor="end"
          onSelectEvent={(ev: RbcEvent) => onOpen(ev.resource.todoId)}
          onShowMore={(evts: RbcEvent[], day: Date) =>
            setDayPopover({ date: day, events: evts })
          }
          eventPropGetter={(ev: RbcEvent) => ({
            className: `tone-${chipTone(ev.resource)}`,
          })}
          components={{ event: EventChip }}
          messages={{
            showMore: (n: number) => nl.calendar.moreEvents(n),
            noEventsInRange: nl.calendar.empty,
          }}
          style={{ height: "100%" }}
        />
      </div>

      <div style={readOnlyNote}>
        <Icon name="circle-alert" size={13} />
        {nl.calendar.readOnlyNote}
      </div>

      {dayPopover ? (
        <DayPopover
          date={dayPopover.date}
          events={dayPopover.events}
          onClose={() => setDayPopover(null)}
          onOpen={(id) => {
            setDayPopover(null);
            onOpen(id);
          }}
        />
      ) : null}
    </div>
  );
}

/** ma–zo rond `date` voor week; het volledige maandraster voor maand. */
function visibleRange(date: Date, view: View): { from: string; to: string } {
  const iso = (d: Date) => dfFormat(d, "yyyy-MM-dd");
  if (view === Views.WEEK) {
    return {
      from: iso(dfStartOfWeek(date, { weekStartsOn: 1 })),
      to: iso(endOfWeek(date, { weekStartsOn: 1 })),
    };
  }
  return {
    from: iso(dfStartOfWeek(startOfMonth(date), { weekStartsOn: 1 })),
    to: iso(endOfWeek(endOfMonth(date), { weekStartsOn: 1 })),
  };
}

/**
 * De chip-tint volgt de driedelige legenda, niet de rauwe backend-tone: een
 * herinnering leest altijd als "Herinnering" (teal), een deadline als "Deadline"
 * (neutraal — of oker vandaag / teal klaar), en alles wat te laat is als
 * "Te laat" (terracotta).
 */
function chipTone(e: CalendarEvent): CalendarTone {
  if (e.tone === "late") return "late";
  if (e.kind === "reminder") return "done";
  return e.tone;
}

/** Legenda-icoon per event: bel voor herinneringen, kalender voor deadlines,
 *  waarschuwing zodra iets te laat is. */
function chipIcon(e: CalendarEvent): IconName {
  if (e.tone === "late") return "circle-alert";
  return e.kind === "reminder" ? "bell" : "calendar";
}

function EventChip({ event }: { event: RbcEvent }) {
  const e = event.resource;
  const time = event.allDay ? nl.calendar.allDay : formatTime(event.start);
  // Keep the content inline (icon as inline-block) so the day-cell's
  // `.rbc-event-content { text-overflow: ellipsis }` still clips a long title.
  return (
    <span title={`${time} · ${e.title}`}>
      <Icon
        name={chipIcon(e)}
        size={12}
        style={{
          display: "inline-block",
          verticalAlign: "-2px",
          marginRight: "4px",
        }}
      />
      {event.allDay ? "" : `${time} `}
      {e.title}
    </span>
  );
}

function LegendItem({
  tone,
  icon,
  label,
}: {
  tone: CalendarTone;
  icon: IconName;
  label: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        color: `var(--${tone}-fg)`,
      }}
    >
      <Icon name={icon} size={13} />
      <span
        style={{
          fontSize: "var(--text-2xs)",
          fontWeight: "var(--weight-bold)",
        }}
      >
        {label}
      </span>
    </span>
  );
}

function DayPopover({
  date,
  events,
  onClose,
  onOpen,
}: {
  date: Date;
  events: RbcEvent[];
  onClose: () => void;
  onOpen: (todoId: number) => void;
}) {
  return (
    <div style={popoverBackdrop} onClick={onClose}>
      <div style={popoverCard} onClick={(e) => e.stopPropagation()}>
        <div style={popoverHead}>
          <span
            style={{ fontWeight: "var(--weight-black)", fontSize: "var(--text-md)" }}
          >
            {formatFullDate(date)}
          </span>
          <span
            style={{ color: "var(--text-muted)", fontWeight: "var(--weight-bold)" }}
          >
            {nl.calendar.dayItems(events.length)}
          </span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            style={navBtn}
            aria-label={nl.beheer.close}
            onClick={onClose}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {events
            .slice()
            .sort((a, b) => a.start.getTime() - b.start.getTime())
            .map((ev) => (
              <button
                key={ev.resource.id}
                type="button"
                onClick={() => onOpen(ev.resource.todoId)}
                style={popoverRow}
              >
                <span
                  style={{
                    width: 54,
                    flex: "none",
                    color: "var(--text-muted)",
                    fontWeight: "var(--weight-bold)",
                    fontSize: "var(--text-xs)",
                  }}
                >
                  {ev.allDay ? nl.calendar.allDay : formatTime(ev.start)}
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontWeight: "var(--weight-bold)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {ev.resource.title}
                </span>
                <MetaChip tone={chipTone(ev.resource)}>
                  {ev.resource.kind === "reminder"
                    ? nl.calendar.legendReminder
                    : nl.calendar.legendDeadline}
                </MetaChip>
              </button>
            ))}
        </div>
        <div
          style={{
            ...readOnlyNote,
            borderTop: "var(--border-width) solid var(--border-subtle)",
            margin: 0,
            padding: "10px 14px",
          }}
        >
          <Icon name="circle-alert" size={13} />
          {nl.calendar.readOnlyNote}
        </div>
      </div>
    </div>
  );
}

// --- styles ----------------------------------------------------------

const toolbar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-4)",
  flexWrap: "wrap",
};
const navBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "var(--control-h-sm)",
  height: "var(--control-h-sm)",
  border: "var(--border-width) solid var(--border-default)",
  borderRadius: "var(--radius)",
  background: "var(--surface-card)",
  color: "var(--text-body)",
  cursor: "pointer",
};
const todayBtn: CSSProperties = {
  height: "var(--control-h-sm)",
  padding: "0 12px",
  border: "var(--border-width) solid var(--border-default)",
  borderRadius: "var(--radius)",
  background: "var(--surface-card)",
  color: "var(--text-body)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-base)",
  fontWeight: "var(--weight-bold)",
  cursor: "pointer",
};
const period: CSSProperties = {
  fontSize: "var(--text-lg)",
  fontWeight: "var(--weight-black)",
  letterSpacing: "-0.2px",
  textTransform: "capitalize",
  marginLeft: "var(--space-3)",
};
const legend: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-5)",
};
const toggleBtn = (active: boolean): CSSProperties => ({
  height: "var(--control-h-sm)",
  padding: "0 var(--control-pad-x-sm)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-base)",
  fontWeight: "var(--weight-bold)",
  borderRadius: "var(--radius)",
  cursor: "pointer",
  border: active
    ? "var(--border-width) solid var(--accent-tint-border)"
    : "var(--border-width) solid var(--border-default)",
  background: active ? "var(--accent-tint)" : "var(--surface-card)",
  color: active ? "var(--accent-text)" : "var(--text-body)",
});
const readOnlyNote: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "var(--text-xs)",
  fontWeight: "var(--weight-bold)",
  color: "var(--text-muted)",
};
const popoverBackdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(43, 52, 49, 0.28)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 40,
};
const popoverCard: CSSProperties = {
  width: 420,
  maxWidth: "90vw",
  background: "var(--surface-card)",
  border: "var(--border-width) solid var(--border-default)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-panel, 0 12px 40px rgba(43,52,49,.2))",
  overflow: "hidden",
};
const popoverHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-4)",
  padding: "12px 14px",
  borderBottom: "var(--border-width) solid var(--border-subtle)",
};
const popoverRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "10px 14px",
  border: "none",
  borderBottom: "var(--border-width) solid var(--border-subtle)",
  background: "transparent",
  width: "100%",
  textAlign: "left",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
};
