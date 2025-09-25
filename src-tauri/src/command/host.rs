use std::sync::Arc;

use tauri_plugin_http::reqwest;

use crate::state::oap::OAPState;

#[tauri::command]
pub async fn host_refresh_config(state: tauri::State<'_, Arc<OAPState>>) -> Result<(), String> {
    let host = state.client.credentials.get_host().await.map_err(|e| e.to_string())?;
    let url = format!("{host}/api/plugins/oap-platform/config/refresh");

    reqwest::get(url).await.map_err(|e| e.to_string())?;
    Ok(())
}
