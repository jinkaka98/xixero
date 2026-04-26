<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { appState, proxyState, configState } from '$lib/stores.svelte.js';
	import { commands } from '$lib/tauri.js';
	import LockScreen from '$lib/components/LockScreen.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';

	let { children } = $props();

	// Load config and proxy status after license validation
	$effect(() => {
		if (appState.isLicensed && !configState.loaded) {
			loadAppData();
		}
	});

	async function loadAppData() {
		try {
			const config = await commands.loadConfig();
			configState.loadFromConfig(config);
			proxyState.setPort(config.proxy_port);

			const status = await commands.getProxyStatus();
			proxyState.update(status);

			// Auto-start proxy if configured
			if (config.auto_start_proxy && !status.running) {
				await commands.startProxy(config.proxy_port);
				const newStatus = await commands.getProxyStatus();
				proxyState.update(newStatus);
			}
		} catch (err) {
			console.error('Failed to load app data:', err);
		}
	}

	// Poll proxy status every 3 seconds when licensed
	$effect(() => {
		if (!appState.isLicensed) return;

		const interval = setInterval(async () => {
			try {
				const status = await commands.getProxyStatus();
				proxyState.update(status);
			} catch {
				// Ignore polling errors
			}
		}, 3000);

		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if !appState.isLicensed}
	<LockScreen />
{:else}
	<div class="flex h-screen bg-surface-950 text-surface-50 overflow-hidden animate-fade-in">
		<Sidebar />
		<main class="flex-1 overflow-y-auto p-8">
			<div class="max-w-5xl mx-auto">
				{@render children()}
			</div>
		</main>
	</div>
{/if}
