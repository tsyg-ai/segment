import appIcon from "@/assets/app-icon.png";
import { NavItem } from "@/components/tasks/NavItem";
import { SectionLabel } from "@/components/display/SectionLabel";
import { t } from "@/i18n";
import { SIDEBAR_GROUPS, type Destination } from "./routes";

/* Ported from designs/ui_kits/takenbeheer/Sidebar.jsx.
   Two labelled groups, no icons, no counts/badges — labels only.
   NO "Instellingen" item (spec: geen instellingenscherm in v1).
   Kalender is a view of Taken, never a sidebar destination.
   The tray notice is pinned to the bottom: always visible (the app can always
   sit in the tray), always-teal dot, and its tooltip carries the "close = tray"
   and "autostart off" copy. */
export function Sidebar({
  active,
  onNavigate,
}: {
  active: Destination;
  onNavigate: (dest: Destination) => void;
}) {
  return (
    <aside
      style={{
        width: "var(--sidebar-w)",
        flex: "none",
        background: "var(--surface-sidebar)",
        borderRight: "var(--border-width) solid var(--border-default)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-10)",
        padding: "var(--space-9) var(--space-7) var(--space-7)",
        overflow: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-5)",
          padding: "0 var(--space-2)",
        }}
      >
        {/* Het echte app-icoon (dezelfde bron als het venster- en tray-icoon):
            de afgeronde hoeken zitten in de afbeelding zelf. */}
        <img
          src={appIcon}
          alt=""
          width={34}
          height={34}
          style={{ display: "block", flex: "none" }}
        />
        <span
          style={{
            fontSize: "15.5px",
            fontWeight: "var(--weight-black)",
            letterSpacing: "-0.2px",
          }}
        >
          {t("app.name")}
        </span>
      </div>

      {SIDEBAR_GROUPS.map((group) => (
        <nav
          key={group.labelKey}
          style={{ display: "flex", flexDirection: "column", gap: "3px" }}
        >
          <SectionLabel style={{ padding: "0 var(--space-4) 5px" }}>
            {t(group.labelKey)}
          </SectionLabel>
          {group.items.map((item) => (
            <NavItem
              key={item.dest}
              active={active === item.dest}
              onClick={() => onNavigate(item.dest)}
            >
              {t(item.labelKey)}
            </NavItem>
          ))}
        </nav>
      ))}

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <div
          title={t("app.trayNoticeTooltip")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
            padding: "10px 12px",
            borderRadius: "var(--radius)",
            background: "var(--paper-700)",
          }}
        >
          {/* Teal, never a project colour: this is app state, not a project. */}
          <span
            style={{
              width: "var(--dot-size)",
              height: "var(--dot-size)",
              borderRadius: "var(--radius-round)",
              background: "var(--accent)",
              flex: "none",
            }}
          />
          <span
            style={{
              fontSize: "12.5px",
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-secondary)",
              lineHeight: "var(--leading-snug)",
            }}
          >
            {t("app.trayNotice")}
          </span>
        </div>
      </div>
    </aside>
  );
}
