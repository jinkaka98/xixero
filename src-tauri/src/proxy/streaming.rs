/// SSE streaming utilities
/// The actual streaming is handled in server.rs via reqwest's bytes_stream()
/// This module provides helper types for traffic logging of streamed responses

use serde::Serialize;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize)]
pub struct TrafficLogEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub method: String,
    pub path: String,
    pub target_provider: String,
    pub target_url: String,
    pub status_code: u16,
    pub latency_ms: u64,
    pub request_size: usize,
    pub response_size: usize,
    pub is_streaming: bool,
    pub model: Option<String>,
}

impl TrafficLogEntry {
    pub fn new(
        method: &str,
        path: &str,
        target_provider: &str,
        target_url: &str,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            method: method.to_string(),
            path: path.to_string(),
            target_provider: target_provider.to_string(),
            target_url: target_url.to_string(),
            status_code: 0,
            latency_ms: 0,
            request_size: 0,
            response_size: 0,
            is_streaming: false,
            model: None,
        }
    }
}
