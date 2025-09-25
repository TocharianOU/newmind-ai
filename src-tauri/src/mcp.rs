use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MCPConfig {
    pub mcp_servers: HashMap<String, MCPConfigItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MCPConfigItem {
    pub transport: String,
    pub enabled: bool,
    pub command: String,
    pub args: Vec<String>,
    pub env: Option<HashMap<String, String>>,
    pub url: Option<String>,
    pub headers: Option<Value>,
    pub extra_data: Option<Value>,
}
