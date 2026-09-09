import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatusPill } from "@/components/display/StatusPill";

describe("StatusPill (ported component)", () => {
  it("renders the status name and the keuzelijst chevron, styled from tokens", () => {
    render(<StatusPill status="busy">Bezig</StatusPill>);
    const pill = screen.getByRole("button", { name: /Bezig/ });
    expect(pill).toHaveTextContent("Bezig");
    // token-driven radius, not a hard-coded pill shape
    expect(pill).toHaveStyle({ borderRadius: "var(--radius)" });
    // the trailing chevron svg
    expect(pill.querySelector("svg")).not.toBeNull();
  });

  it("fires onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <StatusPill status="done" onClick={onClick}>
        Klaar
      </StatusPill>,
    );
    await user.click(screen.getByRole("button", { name: /Klaar/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
