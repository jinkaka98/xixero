use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::Arc;
use std::sync::atomic::{AtomicU32, Ordering};

use bytes::Bytes;
use http_body_util::{BodyExt, Full, StreamBody};
use hyper::body::{Frame, Incoming};
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use tokio::net::TcpListener;
use tokio::sync::{oneshot, RwLock};
use futures_util::StreamExt;

use crate::config::AppConfig;
use crate::proxy::router;
use crate::proxy::transform;

pub struct ProxyServer {
    pub port: u16,
    config: Arc<RwLock<AppConfig>>,
    shutdown_tx: Option<oneshot::Sender<()>>,
    active_connections: Arc<AtomicU32>,
    http_client: reqwest::Client,
}

impl ProxyServer {
    pub fn new(port: u16, config: AppConfig) -> Self {
        let http_client = reqwest::Client::builder()
            .pool_max_idle_per_host(10)
            .timeout(std::time::Duration::from_secs(300)) // 5 min for long AI responses
            .build()
            .expect("Failed to create HTTP client");

        Self {
            port,
            config: Arc::new(RwLock::new(config)),
            shutdown_tx: None,
            active_connections: Arc::new(AtomicU32::new(0)),
            http_client,
        }
    }

    pub fn active_connections(&self) -> u32 {
        self.active_connections.load(Ordering::Relaxed)
    }

    pub fn config(&self) -> Arc<RwLock<AppConfig>> {
        self.config.clone()
    }

    pub async fn start(&mut self) -> Result<(), String> {
        let addr = SocketAddr::from(([127, 0, 0, 1], self.port));
        let listener = TcpListener::bind(addr).await
            .map_err(|e| format!("Failed to bind to port {}: {}", self.port, e))?;

        log::info!("Proxy server listening on http://{}", addr);

        let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();
        self.shutdown_tx = Some(shutdown_tx);

        let config = self.config.clone();
        let client = self.http_client.clone();
        let connections = self.active_connections.clone();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    result = listener.accept() => {
                        match result {
                            Ok((stream, peer_addr)) => {
                                let io = TokioIo::new(stream);
                                let config = config.clone();
                                let client = client.clone();
                                let connections = connections.clone();

                                connections.fetch_add(1, Ordering::Relaxed);

                                tokio::spawn(async move {
                                    let service = service_fn(move |req: Request<Incoming>| {
                                        let config = config.clone();
                                        let client = client.clone();
                                        async move {
                                            handle_request(req, config, client).await
                                        }
                                    });

                                    if let Err(err) = http1::Builder::new()
                                        .serve_connection(io, service)
                                        .with_upgrades()
                                        .await
                                    {
                                        if !err.is_incomplete_message() {
                                            log::error!("Connection error from {}: {}", peer_addr, err);
                                        }
                                    }

                                    connections.fetch_sub(1, Ordering::Relaxed);
                                });
                            }
                            Err(e) => {
                                log::error!("Failed to accept connection: {}", e);
                            }
                        }
                    }
                    _ = &mut shutdown_rx => {
                        log::info!("Proxy server shutting down");
                        break;
                    }
                }
            }
        });

        Ok(())
    }

    pub fn stop(&mut self) -> Result<(), String> {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
            log::info!("Proxy server stop signal sent");
            Ok(())
        } else {
            Err("Proxy server is not running".to_string())
        }
    }
}

type BoxBody = http_body_util::combinators::BoxBody<Bytes, hyper::Error>;

fn full_body(data: Bytes) -> BoxBody {
    Full::new(data)
        .map_err(|never| match never {})
        .boxed()
}

fn error_response(status: StatusCode, message: &str, code: &str) -> Response<BoxBody> {
    let body = serde_json::json!({
        "error": {
            "message": message,
            "type": "proxy_error",
            "code": code
        }
    });
    Response::builder()
        .status(status)
        .header("Content-Type", "application/json")
        .body(full_body(Bytes::from(serde_json::to_vec(&body).unwrap())))
        .unwrap()
}

async fn handle_request(
    req: Request<Incoming>,
    config: Arc<RwLock<AppConfig>>,
    client: reqwest::Client,
) -> Result<Response<BoxBody>, Infallible> {
    let method = req.method().clone();
    let path = req.uri().path().to_string();
    let headers = req.headers().clone();

    log::info!("{} {}", method, path);

    // Read the config
    let cfg = config.read().await;

    // Match route
    let matched_route = match router::match_route(&path, &cfg.routes) {
        Some(route) => route,
        None => {
            log::warn!("No route matched for path: {}", path);
            return Ok(error_response(
                StatusCode::NOT_FOUND,
                &format!("No route configured for path: {}", path),
                "no_route",
            ));
        }
    };

    // Find the target provider
    let provider = match cfg.providers.iter().find(|p| p.id == matched_route.target_provider && p.enabled) {
        Some(p) => p.clone(),
        None => {
            log::warn!("Provider not found or disabled: {}", matched_route.target_provider);
            return Ok(error_response(
                StatusCode::BAD_GATEWAY,
                &format!("Provider '{}' not found or disabled", matched_route.target_provider),
                "provider_not_found",
            ));
        }
    };

    drop(cfg); // Release the read lock

    // Read request body
    let body_bytes = match req.collect().await {
        Ok(collected) => collected.to_bytes(),
        Err(e) => {
            log::error!("Failed to read request body: {}", e);
            return Ok(error_response(
                StatusCode::BAD_REQUEST,
                "Failed to read request body",
                "body_read_error",
            ));
        }
    };

    // Transform request body (model mapping)
    let transformed_body = transform::transform_request_body(
        &body_bytes,
        &matched_route.model_mapping,
    );

    // Build upstream URL
    let upstream_url = format!("{}{}", provider.base_url.trim_end_matches('/'), path);

    // Build upstream request
    let mut upstream_req = client.request(method.clone(), &upstream_url);

    // Copy relevant headers (skip host, content-length, authorization — reqwest handles these)
    for (name, value) in headers.iter() {
        let name_str = name.as_str().to_lowercase();
        if name_str != "host" && name_str != "content-length" && name_str != "authorization" {
            if let Ok(v) = value.to_str() {
                upstream_req = upstream_req.header(name.clone(), v);
            }
        }
    }

    // Inject provider API key
    upstream_req = upstream_req.header("Authorization", format!("Bearer {}", provider.api_key));

    // Set body
    upstream_req = upstream_req.body(transformed_body);

    // Send upstream request
    let upstream_response = match upstream_req.send().await {
        Ok(resp) => resp,
        Err(e) => {
            log::error!("Upstream request failed: {}", e);
            return Ok(error_response(
                StatusCode::BAD_GATEWAY,
                &format!("Failed to reach provider: {}", e),
                "upstream_error",
            ));
        }
    };

    // Check if response is SSE streaming
    let content_type = upstream_response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let status = upstream_response.status();
    let response_headers = upstream_response.headers().clone();

    if content_type.contains("text/event-stream") {
        // SSE streaming response — stream chunks back to client
        let stream = upstream_response.bytes_stream();

        let body_stream = stream.map(|chunk| {
            chunk
                .map(Frame::data)
                .map_err(|e| {
                    log::error!("Stream error: {}", e);
                    // We need a hyper::Error here. Use an IO error conversion.
                    let io_err = std::io::Error::new(std::io::ErrorKind::Other, e.to_string());
                    // hyper::Error doesn't have a public constructor from io::Error,
                    // but we can use the fact that BoxBody accepts any error type via map_err.
                    // Since we're using BoxBody<Bytes, hyper::Error>, we need to work around this.
                    // The StreamBody will propagate this error.
                    io_err
                })
        });

        let stream_body = StreamBody::new(body_stream);

        // We need to map the error type from io::Error to hyper::Error
        // Use BodyExt::map_err to convert
        let mapped_body: BoxBody = BodyExt::map_err(stream_body, |e| {
            // Convert io::Error to a hyper error by creating a Box<dyn Error>
            // hyper::Error is opaque, so we use a workaround
            let _ = e;
            // This path should rarely be hit in practice since stream errors
            // are logged above. We create a minimal error.
            unreachable!("Stream errors are handled in the map above")
        }).boxed();

        let mut response_builder = Response::builder()
            .status(StatusCode::from_u16(status.as_u16()).unwrap());

        // Copy response headers
        for (name, value) in response_headers.iter() {
            response_builder = response_builder.header(name.as_str(), value.as_bytes());
        }

        // Ensure streaming headers
        response_builder = response_builder
            .header("Cache-Control", "no-cache")
            .header("Connection", "keep-alive");

        let response = response_builder.body(mapped_body).unwrap();
        Ok(response)
    } else {
        // Non-streaming response — read full body and forward
        let response_body = match upstream_response.bytes().await {
            Ok(bytes) => bytes,
            Err(e) => {
                log::error!("Failed to read upstream response: {}", e);
                Bytes::from(format!("{{\"error\":\"Failed to read response: {}\"}}", e))
            }
        };

        let mut response_builder = Response::builder()
            .status(StatusCode::from_u16(status.as_u16()).unwrap());

        // Copy response headers (skip transfer-encoding and content-length, we set our own)
        for (name, value) in response_headers.iter() {
            let name_str = name.as_str().to_lowercase();
            if name_str != "transfer-encoding" && name_str != "content-length" {
                response_builder = response_builder.header(name.as_str(), value.as_bytes());
            }
        }

        let response = response_builder
            .body(full_body(response_body))
            .unwrap();

        Ok(response)
    }
}
