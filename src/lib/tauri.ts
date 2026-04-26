import { invoke } from '@tauri-apps/api/core';

export interface ProxyStatus {
	running: boolean;
	port: number;
	active_connections: number;
}

export interface ProviderConfig {
	id: string;
	name: string;
	base_url: string;
	api_key: string;
	models: string[];
	enabled: boolean;
}

export interface RouteConfig {
	id: string;
	name: string;
	path_pattern: string;
	target_provider: string;
	model_mapping: Record<string, string>;
	enabled: boolean;
}

export interface AppConfig {
	proxy_port: number;
	providers: ProviderConfig[];
	routes: RouteConfig[];
	auto_start_proxy: boolean;
}

export const commands = {
	getHwid: () => invoke<{ hwid: string }>('get_hwid'),
	startProxy: (port: number) => invoke<string>('start_proxy', { port }),
	stopProxy: () => invoke<string>('stop_proxy'),
	getProxyStatus: () => invoke<ProxyStatus>('get_proxy_status'),
	updateProxyConfig: () => invoke<string>('update_proxy_config'),
	loadConfig: () => invoke<AppConfig>('load_config'),
	saveConfig: (config: AppConfig) => invoke<string>('save_config', { config })
};
