use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub models: Vec<String>,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RouteConfig {
    pub id: String,
    pub name: String,
    pub path_pattern: String,
    pub target_provider: String,
    pub model_mapping: HashMap<String, String>,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub proxy_port: u16,
    pub providers: Vec<ProviderConfig>,
    pub routes: Vec<RouteConfig>,
    pub auto_start_proxy: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            proxy_port: 1445,
            providers: Vec::new(),
            routes: Vec::new(),
            auto_start_proxy: false,
        }
    }
}
