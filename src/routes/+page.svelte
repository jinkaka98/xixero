<script lang="ts">
	import { proxyState, configState } from '$lib/stores.svelte.js';
	import { commands } from '$lib/tauri.js';
	import {
		Play,
		Square,
		Loader2,
		Server,
		Route,
		Activity,
		Copy,
		Check,
		Zap,
		BookOpen
	} from 'lucide-svelte';

	let isToggling = $state(false);
	let copied = $state(false);

	let proxyEndpoint = $derived(`http://localhost:${proxyState.port}`);
	let providerCount = $derived(configState.providers.filter((p) => p.enabled).length);
	let routeCount = $derived(configState.routes.filter((r) => r.enabled).length);

	async function toggleProxy() {
		isToggling = true;
		try {
			if (proxyState.running) {
				await commands.stopProxy();
			} else {
				await commands.startProxy(configState.proxyPort);
			}
			const status = await commands.getProxyStatus();
			proxyState.update(status);
		} catch (err) {
			console.error('Failed to toggle proxy:', err);
		} finally {
			isToggling = false;
		}
	}

	async function copyEndpoint() {
		try {
			await navigator.clipboard.writeText(proxyEndpoint);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard API may not be available
		}
	}
</script>

<div class="flex flex-col gap-6 animate-slide-up">
	<!-- Page Header -->
	<div class="flex flex-col gap-1">
		<h2 class="text-2xl font-bold text-surface-50">Dashboard</h2>
		<p class="text-sm text-surface-400">Manage your local AI reverse proxy.</p>
	</div>

	<!-- Proxy Control Card -->
	<div class="bg-surface-900 border border-surface-800 rounded-xl p-6 transition-colors duration-200 hover:border-surface-700">
		<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
			<div class="flex items-center gap-4">
				<div class="p-3 rounded-xl transition-colors duration-200 {proxyState.running ? 'bg-primary-500/15 glow-primary-sm' : 'bg-surface-800'}">
					<Zap size={24} class="transition-colors duration-200 {proxyState.running ? 'text-primary-400' : 'text-surface-500'}" />
				</div>
				<div>
					<h3 class="text-lg font-semibold text-surface-50">Proxy Server</h3>
					<p class="text-sm text-surface-400">
						{#if proxyState.running}
							<span class="text-green-500">Running</span> &middot; Port {proxyState.port}
						{:else}
							<span class="text-surface-500">Stopped</span> &middot; Port {proxyState.port}
						{/if}
					</p>
				</div>
			</div>
			<button
				class="btn rounded-lg font-medium min-w-[140px] cursor-pointer transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed
					{proxyState.running ? 'preset-filled-error-500' : 'bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:from-primary-500 hover:to-primary-400'}"
				onclick={toggleProxy}
				disabled={isToggling}
			>
				{#if isToggling}
					<Loader2 size={18} class="animate-spin" />
					<span>{proxyState.running ? 'Stopping...' : 'Starting...'}</span>
				{:else if proxyState.running}
					<Square size={18} />
					<span>Stop Proxy</span>
				{:else}
					<Play size={18} />
					<span>Start Proxy</span>
				{/if}
			</button>
		</div>

		{#if proxyState.running}
			<div class="mt-4 pt-4 border-t border-surface-800">
				<div class="flex items-center gap-3">
					<span class="text-sm text-surface-400">Endpoint:</span>
					<code class="text-sm font-mono bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-surface-200">{proxyEndpoint}</code>
					<button
						class="p-2 rounded-lg hover:bg-surface-800 transition-colors duration-200 cursor-pointer text-surface-400 hover:text-surface-200"
						onclick={copyEndpoint}
						title="Copy endpoint"
					>
						{#if copied}
							<Check size={16} class="text-green-500" />
						{:else}
							<Copy size={16} />
						{/if}
					</button>
				</div>
			</div>
		{/if}
	</div>

	<!-- Stats Grid -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
		<!-- Active Connections -->
		<div class="bg-surface-900 border border-surface-800 rounded-xl p-6 transition-colors duration-200 hover:border-surface-700">
			<div class="flex items-center gap-4">
				<div class="p-2.5 rounded-xl bg-primary-500/10">
					<Activity size={20} class="text-primary-400" />
				</div>
				<div>
					<p class="text-2xl font-bold text-surface-50">{proxyState.activeConnections}</p>
					<p class="text-xs text-surface-400">Active Connections</p>
				</div>
			</div>
		</div>

		<!-- Providers -->
		<div class="bg-surface-900 border border-surface-800 rounded-xl p-6 transition-colors duration-200 hover:border-surface-700">
			<div class="flex items-center gap-4">
				<div class="p-2.5 rounded-xl bg-secondary-500/10">
					<Server size={20} class="text-secondary-400" />
				</div>
				<div>
					<p class="text-2xl font-bold text-surface-50">{providerCount}</p>
					<p class="text-xs text-surface-400">Active Providers</p>
				</div>
			</div>
		</div>

		<!-- Routes -->
		<div class="bg-surface-900 border border-surface-800 rounded-xl p-6 transition-colors duration-200 hover:border-surface-700">
			<div class="flex items-center gap-4">
				<div class="p-2.5 rounded-xl bg-tertiary-500/10">
					<Route size={20} class="text-tertiary-400" />
				</div>
				<div>
					<p class="text-2xl font-bold text-surface-50">{routeCount}</p>
					<p class="text-xs text-surface-400">Active Routes</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Quick Start Guide -->
	<div class="bg-surface-900 border border-surface-800 rounded-xl p-6">
		<div class="flex items-center gap-3 mb-5">
			<BookOpen size={20} class="text-primary-400" />
			<h3 class="text-lg font-semibold text-surface-50">Quick Start</h3>
		</div>
		<div class="flex flex-col gap-4">
			<div class="flex gap-4">
				<span class="flex items-center justify-center w-7 h-7 rounded-lg bg-surface-800 text-xs font-bold text-surface-300 shrink-0">1</span>
				<div>
					<p class="text-sm font-medium text-surface-200">Add a Provider</p>
					<p class="text-sm text-surface-400">Go to Providers and configure your AI provider (OpenAI, Anthropic, etc.) with an API key.</p>
				</div>
			</div>
			<div class="flex gap-4">
				<span class="flex items-center justify-center w-7 h-7 rounded-lg bg-surface-800 text-xs font-bold text-surface-300 shrink-0">2</span>
				<div>
					<p class="text-sm font-medium text-surface-200">Create a Route</p>
					<p class="text-sm text-surface-400">Set up path patterns to route requests to the right provider.</p>
				</div>
			</div>
			<div class="flex gap-4">
				<span class="flex items-center justify-center w-7 h-7 rounded-lg bg-surface-800 text-xs font-bold text-surface-300 shrink-0">3</span>
				<div>
					<p class="text-sm font-medium text-surface-200">Start the Proxy</p>
					<p class="text-sm text-surface-400">
						Click Start above, then point your apps to
						<code class="font-mono text-xs bg-surface-800 border border-surface-700 rounded px-1.5 py-0.5 text-surface-300">{proxyEndpoint}</code>
					</p>
				</div>
			</div>
			<div class="flex gap-4">
				<span class="flex items-center justify-center w-7 h-7 rounded-lg bg-surface-800 text-xs font-bold text-surface-300 shrink-0">4</span>
				<div>
					<p class="text-sm font-medium text-surface-200">Monitor Traffic</p>
					<p class="text-sm text-surface-400">Watch requests flow through in the Traffic Monitor.</p>
				</div>
			</div>
		</div>
	</div>
</div>
