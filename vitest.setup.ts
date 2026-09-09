import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// The Tauri event bridge is not present in jsdom. Every test gets an inert
// `listen`/`emit` so components that subscribe to app events (e.g. the
// `reminder://open` deep-link) mount without touching a real bridge. A test
// that needs to drive an event re-mocks this module locally.
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
  once: vi.fn().mockResolvedValue(() => {}),
}));

// The Tauri IPC bridge does not exist in jsdom. Tests that touch it should mock
// `@/lib/ipc` explicitly; this guard makes an accidental real call fail loudly.
if (!("__TAURI_INTERNALS__" in globalThis)) {
  Object.defineProperty(globalThis, "__TAURI_INTERNALS__", {
    value: {
      invoke: () => {
        throw new Error(
          "Tauri invoke() called in a test without a mock. Mock '@/lib/ipc' in the test.",
        );
      },
    },
    configurable: true,
  });
}
