import { nl } from "./nl";

export { nl } from "./nl";
export type { Nl } from "./nl";

/**
 * Dot-path lookup into the `nl` dictionary for plain string leaves, e.g.
 * `t("nav.dashboard")`.
 *
 * Interpolated strings (`footer.visible`, `footer.late`, …) are functions in
 * `nl` — call them directly (`nl.footer.late(3)`), not through `t()`.
 *
 * An unknown key, or a key that resolves to something other than a string, is a
 * bug. In dev/test it throws so it is caught immediately ("faalt zichtbaar op
 * onbekende keys"); in a production build it degrades to returning
 * the key so the UI still renders.
 */
export function t(path: string): string {
  const value = path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      nl,
    );

  if (typeof value === "string") return value;

  const message =
    typeof value === "function"
      ? `i18n: sleutel "${path}" is een interpolator — roep nl.${path}(…) rechtstreeks aan`
      : `i18n: onbekende sleutel "${path}"`;

  if (import.meta.env?.DEV || import.meta.env?.MODE === "test") {
    throw new Error(message);
  }
  // eslint-disable-next-line no-console
  console.error(message);
  return path;
}
