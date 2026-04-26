use serde::Serialize;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::State;

use crate::proxy::ProxyServer;

/// Shared proxy server state managed by Tauri
pub struct ProxyState {
    pub server: Arc<Mutex<Option<ProxyServer>>>,
}

impl ProxyState {
    pub fn new() -> Self {
        Self {
            server: Arc::new(Mutex::new(None)),
        }
    }
}

#[derive(Serialize, Clone)]
pub struct ProxyStatus {
    pub running: bool,
    pub port: u16,
    pub active_connections: u32,
}

#[tauri::command]
pub async fn start_proxy(
    port: u16,
    state: State<'_, ProxyState>,
) -> Result<String, String> {
    let mut server_lock = state.server.lock().await;

    if server_lock.is_some() {
        return Err("Proxy is already running".to_string());
    }

    // Load config from disk
    let config = crate::commands::config::load_config()?;

    let mut server = ProxyServer::new(port, config);
    server.start().await?;

    log::info!("Proxy server started on port {}", port);
    *server_lock = Some(server);

    Ok(format!("Proxy started on port {}", port))
}

#[tauri::command]
pub async fn stop_proxy(
    state: State<'_, ProxyState>,
) -> Result<String, String> {
    let mut server_lock = state.server.lock().await;

    match server_lock.as_mut() {
        Some(server) => {
            server.stop()?;
            *server_lock = None;
            log::info!("Proxy server stopped");
            Ok("Proxy stopped".to_string())
        }
        None => Err("Proxy is not running".to_string()),
    }
}

#[tauri::command]
pub async fn get_proxy_status(
    state: State<'_, ProxyState>,
) -> Result<ProxyStatus, String> {
    let server_lock = state.server.lock().await;

    match server_lock.as_ref() {
        Some(server) => Ok(ProxyStatus {
            running: true,
            port: server.port,
            active_connections: server.active_connections(),
        }),
        None => Ok(ProxyStatus {
            running: false,
            port: 1445,
            active_connections: 0,
        }),
    }
}

#[tauri::command]
pub async fn update_proxy_config(
    state: State<'_, ProxyState>,
) -> Result<String, String> {
    let server_lock = state.server.lock().await;

    if let Some(server) = server_lock.as_ref() {
        let config = crate::commands::config::load_config()?;
        let config_arc = server.config();
        let mut cfg = config_arc.write().await;
        *cfg = config;
        Ok("Proxy config updated".to_string())
    } else {
        Ok("Proxy not running, config will be loaded on start".to_string())
    }
}
