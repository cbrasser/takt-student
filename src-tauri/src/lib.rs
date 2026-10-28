//! The desktop shell: one window on the web app. The session lives in the
//! webview's own storage, so there is nothing to keep here; links to the
//! account site and to materials open in the browser (plugin-opener). The
//! release build looks for updates from the web app (src/lib/Update.svelte),
//! which installs one through plugin-updater and restarts through
//! plugin-process. The Verlauf's Markdown export is saved through the
//! system's save dialog (export_save).

use tauri::AppHandle;

/// A text the app made (the Verlauf's Markdown export) to wherever the student
/// picks in the system's save dialog: the path comes only from that dialog.
/// False when they cancel.
#[tauri::command]
async fn export_save(app: AppHandle, name: String, text: String) -> Result<bool, String> {
    use tauri_plugin_dialog::DialogExt;
    let mut dialog = app.dialog().file().set_file_name(&name);
    if let Some(ext) = std::path::Path::new(&name).extension().and_then(|e| e.to_str()) {
        dialog = dialog.add_filter(ext.to_uppercase(), &[ext]);
    }
    let Some(chosen) = dialog.blocking_save_file() else {
        return Ok(false);
    };
    let path = chosen.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, text).map_err(|e| e.to_string())?;
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![export_save])
        .run(tauri::generate_context!())
        .expect("error while running Takt");
}
