use tauri::Manager;
use tauri_plugin_log::{Builder as LogBuilder, Target, TargetKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
        #[cfg(debug_assertions)] // only include this code on debug builds
                  {
                    let window = app.get_webview_window("main").unwrap();
                    window.open_devtools();
                  }
        Ok(())
    })
    .plugin(
          LogBuilder::default()
            .level(log::LevelFilter::Debug)          // adjust as needed
            .target(Target::new(
                TargetKind::LogDir {
                  file_name: Some("logs".to_string()),
                },
              ))
            .build()
        )
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
