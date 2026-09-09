import { useEffect, type RefObject } from "react";

/**
 * Calls `onOutside` on a pointer-down that lands outside `ref`, while `active`.
 *
 * The one helper for "click the backdrop to dismiss" on bespoke dropdowns and
 * popovers that aren't wrapped in a scrim by their caller. {@link RowMenu} and a
 * few older screens still roll their own copy — new code should use this.
 */
export function useOutsideClick<T extends HTMLElement>(
  active: boolean,
  ref: RefObject<T | null>,
  onOutside: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      onOutside();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [active, ref, onOutside]);
}
