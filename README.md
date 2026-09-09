# Segment

Single-user desktop task manager. Reusable project templates, task tracking and native Windows reminders.

- Interface: **Dutch only**. Code and database identifiers: **English**.
- Shell: **Tauri v2** (NSIS, per-user install). Frontend: **React + TypeScript + Vite**.
- Data: **SQLite** via `rusqlite`, all access through the Rust core (no `tauri-plugin-sql`).

## Prerequisites

- Node ≥ 20 and **pnpm** (`corepack enable pnpm`)
- Rust stable (`rustup` recommended) + the platform WebView deps Tauri needs

## Commands

```bash
pnpm install
pnpm tauri dev        # run the desktop app (Windows target for v1)
pnpm test             # Vitest + React Testing Library
pnpm lint             # ESLint + Prettier
cargo test --workspace   # Rust: migration + seed + settings tests
pnpm tauri build --bundles nsis   # Windows installer
pnpm tauri build --bundles app,dmg   # macOS app bundle + disk image
```

### Reminder notifications on macOS

macOS delivers notifications under a _bundle identifier_, not under a process.
Under `pnpm tauri dev` the notification plugin impersonates `com.apple.Terminal`,
so reminders arrive attributed to whichever terminal app started the dev server —
if that app has notifications turned off in Settings > Notifications, nothing is
shown. A release build uses our own identifier, which macOS only knows once the
app runs as a `.app` bundle. Both failures are silent inside the plugin, so the
app logs which case applies at startup.

## Database

On first launch the app creates the SQLite file in the per-user app-data
directory (`…/be.tsyg.takenbeheer/takenbeheer.db`), runs migration `0001` (the
full v1 schema) and seeds the three default statuses **Te doen** (default),
**Bezig**, **Klaar** (done). Subsequent launches migrate only if needed. A failed
migration shows a Dutch error dialog instead of crashing silently.

All datetimes are **local wall-clock time with no stored timezone** (spec §1, §6.5).

## Auto-update

The app checks **once per local day** on startup for a new version
(`tauri-plugin-updater`, GitHub Releases `latest.json`). No internet is a silent
no-op. When a new version is found the app shows its **own in-app modal** and
only downloads/installs **after you confirm** — there is no settings screen. A
v1 update ships **app code only** (no system templates).

`src-tauri/tauri.conf.json` carries the updater **public** key and the feed
`endpoints`. Point the endpoint at the public repo before the first release:

```
https://github.com/<OWNER>/<REPO>/releases/latest/download/latest.json
```

The matching **private** key is generated once by the maintainer and never
committed:

```bash
pnpm tauri signer generate -w src-tauri/updater-key
```

`src-tauri/updater-key*` is git-ignored. Put the private key and its password in
the repo secrets `TAURI_SIGNING_PRIVATE_KEY` and
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, and paste the generated public key into
`plugins.updater.pubkey`.

## Releasing

CI has two workflows:

| Workflow                        | Trigger             | Does                                                                                                      |
| ------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`      | push to `main`, PRs | lint + test + build (frontend & Rust) + a Windows build check                                             |
| `.github/workflows/release.yml` | push of a `v*` tag  | build the NSIS installer, sign the update artefacts, publish `latest.json` + binaries to a GitHub Release |

To cut a release: bump `version` in `package.json` and
`src-tauri/tauri.conf.json`, commit, then

```bash
git tag v0.2.0 && git push origin v0.2.0
```

### Windows code signing — deferred

The installer is **not** Authenticode code-signed yet (deferred until after the
first user tests). On first run Windows SmartScreen shows a one-time
"Windows protected your PC" warning — choose **More info → Run anyway**. This is
expected for the test round; the updater artefacts are still cryptographically
signed with the updater keypair, so in-app updates remain trustworthy.
