use crate::config::RouteConfig;

/// Matches an incoming request path against configured routes.
/// Routes are checked in order — first match wins.
pub fn match_route(path: &str, routes: &[RouteConfig]) -> Option<RouteConfig> {
    routes
        .iter()
        .filter(|r| r.enabled)
        .find(|r| path_matches(path, &r.path_pattern))
        .cloned()
}

fn path_matches(path: &str, pattern: &str) -> bool {
    // Catch-all patterns
    if pattern == "*" || pattern == "/**" || pattern == "/" {
        return true;
    }

    // Wildcard suffix: /v1/** matches /v1/anything/here
    if pattern.ends_with("/**") {
        let prefix = &pattern[..pattern.len() - 3];
        return path == prefix || path.starts_with(&format!("{}/", prefix));
    }

    // Wildcard segment: /v1/*/completions matches /v1/chat/completions
    if pattern.contains('*') {
        let pattern_parts: Vec<&str> = pattern.split('/').collect();
        let path_parts: Vec<&str> = path.split('/').collect();

        if pattern_parts.len() != path_parts.len() {
            return false;
        }

        return pattern_parts.iter().zip(path_parts.iter()).all(|(p, s)| {
            *p == "*" || p == s
        });
    }

    // Exact match or prefix match
    path == pattern || path.starts_with(&format!("{}/", pattern))
}

/// Maps a model name based on route configuration
pub fn map_model(model: &str, route: &RouteConfig) -> String {
    route
        .model_mapping
        .get(model)
        .cloned()
        .unwrap_or_else(|| model.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn make_route(pattern: &str) -> RouteConfig {
        RouteConfig {
            id: "test".to_string(),
            name: "Test Route".to_string(),
            path_pattern: pattern.to_string(),
            target_provider: "openai".to_string(),
            model_mapping: HashMap::new(),
            enabled: true,
        }
    }

    #[test]
    fn test_catch_all() {
        assert!(path_matches("/v1/chat/completions", "*"));
        assert!(path_matches("/v1/chat/completions", "/**"));
        assert!(path_matches("/anything", "/"));
    }

    #[test]
    fn test_wildcard_suffix() {
        assert!(path_matches("/v1/chat/completions", "/v1/**"));
        assert!(path_matches("/v1/models", "/v1/**"));
        assert!(path_matches("/v1", "/v1/**"));
        assert!(!path_matches("/v2/chat", "/v1/**"));
    }

    #[test]
    fn test_wildcard_segment() {
        assert!(path_matches("/v1/chat/completions", "/v1/*/completions"));
        assert!(!path_matches("/v1/chat/models", "/v1/*/completions"));
    }

    #[test]
    fn test_exact_match() {
        assert!(path_matches("/v1/chat/completions", "/v1/chat/completions"));
        assert!(!path_matches("/v1/chat/completions", "/v1/models"));
    }

    #[test]
    fn test_prefix_match() {
        assert!(path_matches("/v1/chat/completions", "/v1/chat"));
        assert!(!path_matches("/v1/models", "/v1/chat"));
    }

    #[test]
    fn test_match_route_first_wins() {
        let routes = vec![
            make_route("/v1/chat/completions"),
            make_route("/v1/**"),
        ];
        let matched = match_route("/v1/chat/completions", &routes);
        assert!(matched.is_some());
        assert_eq!(matched.unwrap().path_pattern, "/v1/chat/completions");
    }

    #[test]
    fn test_match_route_disabled_skipped() {
        let mut route = make_route("/v1/**");
        route.enabled = false;
        let routes = vec![route];
        assert!(match_route("/v1/chat/completions", &routes).is_none());
    }

    #[test]
    fn test_map_model() {
        let mut mapping = HashMap::new();
        mapping.insert("gpt-4".to_string(), "claude-sonnet-4-20250514".to_string());
        let route = RouteConfig {
            id: "test".to_string(),
            name: "Test".to_string(),
            path_pattern: "/v1/**".to_string(),
            target_provider: "anthropic".to_string(),
            model_mapping: mapping,
            enabled: true,
        };
        assert_eq!(map_model("gpt-4", &route), "claude-sonnet-4-20250514");
        assert_eq!(map_model("gpt-3.5-turbo", &route), "gpt-3.5-turbo");
    }
}
