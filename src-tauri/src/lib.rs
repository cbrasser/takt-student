//! The desktop shell: one window on the web app. The session lives in the
//! webview's own storage, so there is nothing to keep here; links to the
//! account site and to materials open in the browser (plugin-opener). The
//! release build looks for updates from the web app (src/lib/Update.svelte),
//! which installs one through plugin-updater and restarts through
//! plugin-process. "Exit-Ticket ist offen" is an OS notification
//! (plugin-notification), sent from the web app's polling.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error while running Takt");
}
