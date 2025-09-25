use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfig {
    pub active_provider: String,
    pub enable_tools: bool,
    pub configs: HashMap<String, ModelConfigItem>,
    pub disable_dive_system_prompt: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfigItem {
    pub model_provider: String,
    pub model: String,
    pub api_key: String,
    pub configuration: Value,
    pub active: bool,
    pub checked: bool,
    pub tools_in_prompt: bool,
    #[serde(rename = "disable_streaming")]
    pub disable_streaming: bool,
}
