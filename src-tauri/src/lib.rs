//! The desktop shell: one window on the web app. The session lives in the
//! webview's own storage, so there is nothing to keep here; links to the
//! account site and to materials open in the browser (plugin-opener).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running Takt");
}
