import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "@/App";
import { nl } from "@/i18n";

describe("App shell", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("renders the two sidebar groups with all six destinations and no Instellingen", () => {
    render(<App />);

    const sidebar = screen.getByRole("complementary");
    // Groups
    expect(within(sidebar).getByText(nl.nav.groupOverview)).toBeInTheDocument();
    expect(within(sidebar).getByText(nl.nav.groupManage)).toBeInTheDocument();

    // Six destinations
    for (const label of [
      nl.nav.dashboard,
      nl.nav.tasks,
      nl.nav.projects,
      nl.nav.templates,
      nl.nav.attributes,
      nl.nav.statuses,
    ]) {
      expect(within(sidebar).getByRole("link", { name: label })).toBeInTheDocument();
    }

    // Explicitly NOT present
    expect(within(sidebar).queryByText("Instellingen")).not.toBeInTheDocument();

    // Tray notice pinned at the bottom
    expect(within(sidebar).getByText(nl.app.trayNotice)).toBeInTheDocument();
  });

  it("renders the tray notice with the always-teal dot and the close/autostart tooltip", () => {
    render(<App />);
    const sidebar = screen.getByRole("complementary");

    const notice = within(sidebar).getByText(nl.app.trayNotice);
    const box = notice.parentElement as HTMLElement;
    // The tooltip carries the "close = tray" + "autostart off" copy.
    expect(box).toHaveAttribute("title", nl.app.trayNoticeTooltip);

    // First child is the status dot — always the teal accent, never a project colour.
    const dot = box.firstElementChild as HTMLElement;
    expect(dot).toHaveStyle({ background: "var(--accent)" });
  });

  it("does not show Kalender as a sidebar destination, but reaches it as a sub-view of Taken", async () => {
    const user = userEvent.setup();
    render(<App />);

    const sidebar = screen.getByRole("complementary");
    expect(
      within(sidebar).queryByRole("link", { name: nl.taskViews.calendar }),
    ).not.toBeInTheDocument();

    await user.click(within(sidebar).getByRole("link", { name: nl.nav.tasks }));
    const calendarTab = await screen.findByRole("button", {
      name: nl.taskViews.calendar,
    });
    expect(calendarTab).toBeInTheDocument();

    await user.click(calendarTab);
    expect(window.location.hash).toBe("#/taken/calendar");
  });

  it("navigates between destinations and marks the active item", async () => {
    const user = userEvent.setup();
    render(<App />);
    const sidebar = screen.getByRole("complementary");

    await user.click(within(sidebar).getByRole("link", { name: nl.nav.statuses }));
    expect(
      screen.getByRole("heading", { name: nl.nav.statuses, level: 1 }),
    ).toBeInTheDocument();
    expect(
      within(sidebar).getByRole("link", { name: nl.nav.statuses }),
    ).toHaveAttribute("aria-current", "page");
  });
});
