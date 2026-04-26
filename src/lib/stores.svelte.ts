import type { AppConfig, ProviderConfig, RouteConfig } from './tauri.js';

// ── License State ──────────────────────────────────────────────────────
interface LicenseState {
	isLicensed: boolean;
	licenseKey: string;
	licensePlan: string;
	licenseExpiresAt: string;
	isValidating: boolean;
	error: string;
}

function createAppState() {
	let state = $state<LicenseState>({
		isLicensed: false,
		licenseKey: '',
		licensePlan: '',
		licenseExpiresAt: '',
		isValidating: false,
		error: ''
	});

	// Restore saved license key from localStorage
	if (typeof window !== 'undefined') {
		const saved = localStorage.getItem('xixero_license_key');
		if (saved) {
			state.licenseKey = saved;
		}
	}

	return {
		get isLicensed() { return state.isLicensed; },
		get licenseKey() { return state.licenseKey; },
		get licensePlan() { return state.licensePlan; },
		get licenseExpiresAt() { return state.licenseExpiresAt; },
		get isValidating() { return state.isValidating; },
		get error() { return state.error; },

		setValidating(v: boolean) { state.isValidating = v; },
		setError(e: string) { state.error = e; },
		setLicenseKey(key: string) {
			state.licenseKey = key;
			if (typeof window !== 'undefined') {
				localStorage.setItem('xixero_license_key', key);
			}
		},
		setLicensed(info: { plan: string; expiresAt: string }) {
			state.isLicensed = true;
			state.licensePlan = info.plan;
			state.licenseExpiresAt = info.expiresAt;
			state.error = '';
		},
		logout() {
			state.isLicensed = false;
			state.licenseKey = '';
			state.licensePlan = '';
			state.licenseExpiresAt = '';
			state.error = '';
			if (typeof window !== 'undefined') {
				localStorage.removeItem('xixero_license_key');
			}
		}
	};
}

// ── Proxy State ────────────────────────────────────────────────────────
interface ProxyStateData {
	running: boolean;
	port: number;
	activeConnections: number;
}

function createProxyState() {
	let state = $state<ProxyStateData>({
		running: false,
		port: 1445,
		activeConnections: 0
	});

	return {
		get running() { return state.running; },
		get port() { return state.port; },
		get activeConnections() { return state.activeConnections; },

		setRunning(v: boolean) { state.running = v; },
		setPort(p: number) { state.port = p; },
		setActiveConnections(n: number) { state.activeConnections = n; },
		update(status: { running: boolean; port: number; active_connections: number }) {
			state.running = status.running;
			state.port = status.port;
			state.activeConnections = status.active_connections;
		}
	};
}

// ── Config State ───────────────────────────────────────────────────────
interface ConfigStateData {
	providers: ProviderConfig[];
	routes: RouteConfig[];
	proxyPort: number;
	autoStartProxy: boolean;
	loaded: boolean;
}

function createConfigState() {
	let state = $state<ConfigStateData>({
		providers: [],
		routes: [],
		proxyPort: 1445,
		autoStartProxy: false,
		loaded: false
	});

	return {
		get providers() { return state.providers; },
		get routes() { return state.routes; },
		get proxyPort() { return state.proxyPort; },
		get autoStartProxy() { return state.autoStartProxy; },
		get loaded() { return state.loaded; },

		setProviders(p: ProviderConfig[]) { state.providers = p; },
		setRoutes(r: RouteConfig[]) { state.routes = r; },
		setProxyPort(p: number) { state.proxyPort = p; },
		setAutoStartProxy(v: boolean) { state.autoStartProxy = v; },

		loadFromConfig(config: AppConfig) {
			state.providers = config.providers;
			state.routes = config.routes;
			state.proxyPort = config.proxy_port;
			state.autoStartProxy = config.auto_start_proxy;
			state.loaded = true;
		},

		toAppConfig(): AppConfig {
			return {
				proxy_port: state.proxyPort,
				providers: state.providers,
				routes: state.routes,
				auto_start_proxy: state.autoStartProxy
			};
		},

		addProvider(p: ProviderConfig) {
			state.providers = [...state.providers, p];
		},
		updateProvider(id: string, updated: ProviderConfig) {
			state.providers = state.providers.map((p) => (p.id === id ? updated : p));
		},
		removeProvider(id: string) {
			state.providers = state.providers.filter((p) => p.id !== id);
		},

		addRoute(r: RouteConfig) {
			state.routes = [...state.routes, r];
		},
		updateRoute(id: string, updated: RouteConfig) {
			state.routes = state.routes.map((r) => (r.id === id ? updated : r));
		},
		removeRoute(id: string) {
			state.routes = state.routes.filter((r) => r.id !== id);
		}
	};
}

// ── UI State ───────────────────────────────────────────────────────────
function createUiState() {
	let sidebarCollapsed = $state(false);

	return {
		get sidebarCollapsed() { return sidebarCollapsed; },
		toggleSidebar() { sidebarCollapsed = !sidebarCollapsed; },
		setSidebarCollapsed(v: boolean) { sidebarCollapsed = v; }
	};
}

// ── Traffic Monitor State ──────────────────────────────────────────────
export interface TrafficEntry {
	id: string;
	timestamp: Date;
	method: string;
	path: string;
	provider: string;
	status: number;
	latency: number;
}

function createTrafficState() {
	let entries = $state<TrafficEntry[]>([]);

	return {
		get entries() { return entries; },
		addEntry(entry: TrafficEntry) {
			entries = [entry, ...entries].slice(0, 200);
		},
		clear() {
			entries = [];
		}
	};
}

// ── Singleton Exports ──────────────────────────────────────────────────
export const appState = createAppState();
export const proxyState = createProxyState();
export const configState = createConfigState();
export const uiState = createUiState();
export const trafficState = createTrafficState();
