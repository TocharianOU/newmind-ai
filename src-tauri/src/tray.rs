use anyhow::Result;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

const QUIT_MENU_ITEM_ID: &str = "quit";
const SHOW_MENU_ITEM_ID: &str = "show";

pub fn init_system_tray(app: &tauri::App) -> Result<TrayIcon> {
    let show_item = MenuItem::with_id(app, SHOW_MENU_ITEM_ID, "Show Window", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, QUIT_MENU_ITEM_ID, "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .show_menu_on_left_click(false)
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            SHOW_MENU_ITEM_ID => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            QUIT_MENU_ITEM_ID => {
                log::info!("Quitting application from tray");
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } => {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
            TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            } => {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        })
        .build(app)?;

    Ok(tray)
}
