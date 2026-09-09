import { describe, it, expect } from "vitest";
import { t, nl } from "@/i18n";
import { formatNumber, formatQuantity } from "@/i18n/format";

describe("t()", () => {
  it("returns a known string leaf verbatim", () => {
    expect(t("nav.dashboard")).toBe(nl.nav.dashboard);
    expect(t("status.todo")).toBe("Te doen");
  });

  it("exposes interpolators on nl directly, not through t()", () => {
    expect(nl.footer.late(3)).toBe("3 te laat");
    expect(nl.footer.visible(11, 38)).toBe("11 van 38 taken zichtbaar");
    expect(() => t("footer.late")).toThrow(/interpolator/);
  });

  it("throws visibly on an unknown key (dev/test)", () => {
    expect(() => t("nav.instellingen")).toThrow(/onbekende sleutel/);
    expect(() => t("does.not.exist")).toThrow();
  });
});

describe("nl number formatting", () => {
  it("uses a comma as the decimal separator", () => {
    expect(formatNumber(1.5)).toBe("1,5");
    expect(formatQuantity(1.5, "u")).toBe("1,5 u");
  });

  it("keeps whatever precision the value has, without rounding", () => {
    expect(formatNumber(3)).toBe("3");
    expect(formatNumber(3.14159)).toBe("3,14159");
  });
});
