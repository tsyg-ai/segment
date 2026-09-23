# AGENTS.md

Single-user desktop task manager ("Takenbeheer") for CLB counsellors. Tauri v2 + React/TS/Vite frontend, SQLite via `rusqlite` in a Rust workspace.

## Structure

- `core/` — crate `takenbeheer-core`: all DB access, migrations and business logic. Integration tests per plan in `core/tests/plan*.rs`, run against an in-memory DB via the public API.
- `src-tauri/` — Tauri shell only: commands, background task, tray, updater; all data access delegates to `core`.
- `src/` — React frontend; tests in `src/test/` (Vitest, jsdom, globals).
- `specs/` — product spec, v3 is current. `plans/` — ordered implementation plans; 1–7 are Dutch, the `08-*` maintenance track is English.
- `designs/` — frozen reference material (mockups + component JSX). **Never import it** — port what you need into `src/` (ESLint blocks it). UI work must follow `designs/readme.md`. Mockups link subpages via `<dc-import name="_dashboard" screen="start" hint-size="1410px,830px"></dc-import>`, which refers to `_dashboard.dc.html`.

## Commands

pnpm 9.15.0 (`corepack enable pnpm`), Node ≥ 20, Rust pinned to 1.98.0 in `rust-toolchain.toml` (bump it together with `cargo fmt --all` when upgrading).

```bash
pnpm tauri dev                    # full desktop app
pnpm lint && pnpm typecheck && pnpm test   # frontend checks (pnpm build also typechecks)
cargo fmt --all --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace  # Rust checks, CI order
pnpm test src/test/App.test.tsx   # single Vitest file
cargo test -p takenbeheer-core --test plan7  # single Rust test file
```

## Conventions

- UI copy is **Dutch only** with a fixed vocabulary: Taak · Project · Sjabloon · Kenmerk · Status · Herinnering · Keuzelijst. Never "todo", "template", "attribuut", "reminder" or "tag" in UI strings. Code and DB identifiers are English.
- Commits in English.
- Datetimes are local wall-clock time with no stored timezone.
- New migrations go in `core/src/migrations/NNNN_*.sql`, sequentially numbered.

## Gotchas

- Don't try to check the app itself. It won't work. Let the user do the testing in-app.
- Vitest has no Tauri bridge: an unmocked `invoke` fails loudly — mock `@/lib/ipc` in the test. The event bridge is pre-mocked inertly in `vitest.setup.ts`.
- On macOS, reminders under `pnpm tauri dev` are attributed to the terminal's bundle ID and silently never show if that app has notifications off (details in README).
- Release: bump `version` in `package.json` **and** `src-tauri/tauri.conf.json`, commit, then push a `v*` tag (triggers `release.yml`).
