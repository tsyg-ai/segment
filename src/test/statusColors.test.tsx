import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "@/components/display/StatusPill";
import { STATUS_COLORS } from "@/lib/statusTypes";
import { PROJECT_COLORS } from "@/lib/taskTypes";
import { hexToRgb, tintFromHex } from "@/lib/colorTint";

describe("kleurenrampen", () => {
  it("bieden variatie en houden de oorspronkelijke kleuren vooraan", () => {
    expect(PROJECT_COLORS.slice(0, 5)).toEqual([
      "#7A8F6E",
      "#A8806B",
      "#8C7391",
      "#6E8296",
      "#C3CBC6",
    ]);
    expect(STATUS_COLORS.slice(0, 6)).toEqual([
      "#5E6A65",
      "#96701A",
      "#4A6B8A",
      "#1F6F66",
      "#B9512F",
      "#6E5A86",
    ]);
    for (const ramp of [PROJECT_COLORS, STATUS_COLORS]) {
      expect(ramp.length).toBeGreaterThanOrEqual(16);
      expect(new Set(ramp).size).toBe(ramp.length);
      for (const c of ramp) expect(hexToRgb(c)).not.toBeNull();
    }
  });
});

describe("tintFromHex", () => {
  it("levert tinten voor een hex en null voor onbruikbare waarden", () => {
    const t = tintFromHex("#4A6B8A");
    expect(t).not.toBeNull();
    expect(t!.background).toBe("rgba(74, 107, 138, 0.14)");
    expect(t!.borderColor).toBe("rgba(74, 107, 138, 0.42)");
    expect(tintFromHex("var(--accent)")).toBeNull();
    expect(tintFromHex(null)).toBeNull();
  });

  it("verdonkert bleke rampkleuren sterker dan verzadigde", () => {
    const pale = hexToRgb2(tintFromHex("#C3CBC6")!.color)!;
    const deep = hexToRgb2(tintFromHex("#1F6F66")!.color)!;
    // beide moeten donkerder zijn dan de bron, de bleke het meest
    expect(pale.r).toBeLessThan(0xc3 * 0.7);
    expect(deep.r).toBeLessThan(0x1f + 1);
  });
});

/** `rgb(r, g, b)` → kanalen; tintFromHex geeft rgb(), geen hex, terug. */
function hexToRgb2(rgb: string) {
  const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(rgb);
  return m ? { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) } : null;
}

describe("StatusPill met eigen statuskleur", () => {
  it("draagt de kleur van de actieve status i.p.v. de generieke toon", () => {
    render(
      <StatusPill status="todo" color="#4A6B8A">
        Nagekeken
      </StatusPill>,
    );
    expect(screen.getByRole("button", { name: /Nagekeken/ })).toHaveStyle({
      background: "rgba(74, 107, 138, 0.14)",
    });
  });

  it("valt terug op de tokentoon bij een onbruikbare kleur", () => {
    render(
      <StatusPill status="done" color="niet-een-hex">
        Klaar
      </StatusPill>,
    );
    expect(screen.getByRole("button", { name: /Klaar/ })).toHaveStyle({
      background: "var(--accent-tint)",
    });
  });
});
