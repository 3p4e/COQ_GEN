// COQ_GEN desktop shell.
//
// Phase 0 scaffold: on startup, spawn the Python Core API sidecar bound to
// 127.0.0.1 and supervise it for the app lifetime. In production the sidecar is
// bundled as a Tauri "sidecar" binary (PyInstaller) and a per-session token is
// generated and passed via COQGEN_SESSION_TOKEN; here we use the dev default.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::Mutex;

struct Sidecar(Mutex<Option<Child>>);

fn spawn_sidecar() -> Option<Child> {
    // Dev: run the installed package. Prod: replace with a bundled sidecar binary.
    Command::new("python3")
        .args(["-m", "coqgen_core.main"])
        .env("COQGEN_BIND_HOST", "127.0.0.1")
        .env("COQGEN_BIND_PORT", "8765")
        .spawn()
        .ok()
}

fn main() {
    tauri::Builder::default()
        .manage(Sidecar(Mutex::new(spawn_sidecar())))
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<Sidecar>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(child) = guard.as_mut() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running COQ_GEN");
}
