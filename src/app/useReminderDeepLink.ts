import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

/**
 * A click on a native reminder notification brings the app
 * forward (done Rust-side) and emits `reminder://open` with the `todo_id`.
 * This hook routes that into `onOpen`, which navigates to Taken and opens the
 * taakdetailpaneel. Safe outside Tauri: a failing `listen` is swallowed.
 */
export const REMINDER_OPEN_EVENT = "reminder://open";

export function useReminderDeepLink(onOpen: (todoId: number) => void): void {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    listen<number>(REMINDER_OPEN_EVENT, (event) => {
      if (typeof event.payload === "number") onOpen(event.payload);
    })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => {
        /* not running inside Tauri — no deep-link */
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [onOpen]);
}
