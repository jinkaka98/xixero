use serde_json::Value;
use std::collections::HashMap;

/// Transform request body — map model names in JSON payloads
pub fn transform_request_body(
    body: &[u8],
    model_mapping: &HashMap<String, String>,
) -> Vec<u8> {
    if body.is_empty() || model_mapping.is_empty() {
        return body.to_vec();
    }

    // Try to parse as JSON
    let mut json: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return body.to_vec(), // Not JSON, pass through
    };

    // Map the "model" field if present
    if let Some(model) = json.get("model").and_then(|m| m.as_str()) {
        if let Some(mapped) = model_mapping.get(model) {
            log::info!("Model mapped: {} -> {}", model, mapped);
            json["model"] = Value::String(mapped.clone());
        }
    }

    serde_json::to_vec(&json).unwrap_or_else(|_| body.to_vec())
}

/// Transform response body if needed (currently passthrough)
pub fn transform_response_body(body: &[u8]) -> Vec<u8> {
    body.to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_mapping() {
        let body = br#"{"model": "gpt-4", "messages": [{"role": "user", "content": "hello"}]}"#;
        let mut mapping = HashMap::new();
        mapping.insert("gpt-4".to_string(), "claude-sonnet-4-20250514".to_string());

        let result = transform_request_body(body, &mapping);
        let json: Value = serde_json::from_slice(&result).unwrap();
        assert_eq!(json["model"], "claude-sonnet-4-20250514");
    }

    #[test]
    fn test_no_mapping() {
        let body = br#"{"model": "gpt-4", "messages": []}"#;
        let mapping = HashMap::new();
        let result = transform_request_body(body, &mapping);
        assert_eq!(result, body.to_vec());
    }

    #[test]
    fn test_empty_body() {
        let mapping = HashMap::new();
        let result = transform_request_body(b"", &mapping);
        assert!(result.is_empty());
    }

    #[test]
    fn test_non_json_passthrough() {
        let body = b"this is not json";
        let mut mapping = HashMap::new();
        mapping.insert("gpt-4".to_string(), "claude-sonnet-4-20250514".to_string());
        let result = transform_request_body(body, &mapping);
        assert_eq!(result, body.to_vec());
    }

    #[test]
    fn test_no_model_field() {
        let body = br#"{"messages": [{"role": "user", "content": "hello"}]}"#;
        let mut mapping = HashMap::new();
        mapping.insert("gpt-4".to_string(), "claude-sonnet-4-20250514".to_string());
        let result = transform_request_body(body, &mapping);
        let json: Value = serde_json::from_slice(&result).unwrap();
        assert!(json.get("model").is_none());
    }

    #[test]
    fn test_unmapped_model_passthrough() {
        let body = br#"{"model": "gpt-3.5-turbo", "messages": []}"#;
        let mut mapping = HashMap::new();
        mapping.insert("gpt-4".to_string(), "claude-sonnet-4-20250514".to_string());
        let result = transform_request_body(body, &mapping);
        let json: Value = serde_json::from_slice(&result).unwrap();
        assert_eq!(json["model"], "gpt-3.5-turbo");
    }
}
