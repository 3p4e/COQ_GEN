# COQ_GEN Desktop (Tauri + React + TypeScript)

Phase 0 shell. Renders Core API health + the product‑spec list as a connectivity smoke
screen; spawns and supervises the Python **Core API sidecar** (`127.0.0.1:8765`).

## Run (dev)

Prereqs: Node 22, Rust toolchain, and the OS webview deps Tauri needs
(`libwebkit2gtk-4.1`, `libgtk-3`, etc. on Linux). The Python sidecar must be importable
(`pip install -e services/core_api packages/schemas`) so the Rust shell can spawn
`python3 -m coqgen_core.main`.

```bash
npm install
npm run tauri dev      # launches the shell; spawns the sidecar
# or browser-only UI (sidecar started separately via `make api`):
npm run dev            # http://localhost:1420
```

## Build

```bash
npm run build          # tsc + vite build  (CI runs this)
npm run tauri build    # signed installers (msi/dmg/AppImage) — needs platform toolchains
```

## Notes

- CSP restricts `connect-src` to `'self'` + `http://127.0.0.1:8765` (the sidecar only).
- In production the sidecar is bundled as a Tauri **sidecar** binary (PyInstaller) and the
  shell generates a per‑session token passed as `COQGEN_SESSION_TOKEN` (see `src-tauri/src/main.rs`).
- This directory is scaffold: it type‑checks and `vite build`s in CI; full `tauri build`
  requires the native toolchains and is run on packaging runners.
