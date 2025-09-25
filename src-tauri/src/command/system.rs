use crate::state::AppState;

#[tauri::command]
pub async fn system_get_minimize_to_tray(state: tauri::State<'_, AppState>) -> Result<bool, ()> {
    Ok(state.get_minimize_to_tray())
}

#[tauri::command]
pub async fn system_set_minimize_to_tray(
    enable: bool,
    state: tauri::State<'_, AppState>,
) -> Result<bool, ()> {
    state.set_minimize_to_tray(enable);
    Ok(true)
}
