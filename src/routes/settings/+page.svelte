<script lang="ts">
	import { appState, configState, proxyState } from '$lib/stores.svelte.js';
	import { commands } from '$lib/tauri.js';
	import { deactivateLicense } from '$lib/license.js';
	import { Switch } from '@skeletonlabs/skeleton-svelte';
	import {
		Save,
		Loader2,
		KeyRound,
		Shield,
		Calendar,
		LogOut,
		Network,
		Info,
		Zap
	} from 'lucide-svelte';

	let saving = $state(false);
	let deactivating = $state(false);
	let showDeactivateConfirm = $state(false);
	let portInput = $state(configState.proxyPort);
	let autoStart = $state(configState.autoStartProxy);

	// Sync when config loads
	$effect(() => {
		portInput = configState.proxyPort;
		autoStart = configState.autoStartProxy;
	});

	async function saveSettings() {
		saving = true;
		try {
			configState.setProxyPort(portInput);
			configState.setAutoStartProxy(autoStart);
			await commands.saveConfig(configState.toAppConfig());
			proxyState.setPort(portInput);
		} catch (err) {
			console.error('Failed to save settings:', err);
		} finally {
			saving = false;
		}
	}

	async function handleDeactivate() {
		deactivating = true;
		try {
			// Stop proxy first if running
			if (proxyState.running) {
				await commands.stopProxy();
				proxyState.setRunning(false);
			}
			await deactivateLicense();
		} catch (err) {
			console.error('Failed to deactivate:', err);
		} finally {
			deactivating = false;
			showDeactivateConfirm = false;
		}
	}

	function maskKey(key: string): string {
		if (key.length <= 8) return '****';
		return key.slice(0, 4) + '-****-****-' + key.slice(-4);
	}

	function formatExpiry(date: string): string {
		if (!date || date === 'Never') return 'Never';
		try {
			return new Date(date).toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});
		} catch {
			return date;
		}
	}
</script>

<div class="flex flex-col gap-6 max-w-2xl animate-slide-up">
	<!-- Header -->
	<div>
		<h2 class="text-2xl font-bold text-surface-50">Settings</h2>
		<p class="text-sm text-surface-400">Configure proxy and application settings.</p>
	</div>

	<!-- Proxy Settings -->
	<div class="bg-surface-900 border border-surface-800 rounded-xl p-6">
		<div class="flex items-center gap-3 mb-6">
			<div class="p-2 rounded-lg bg-primary-500/10">
				<Network size={18} class="text-primary-400" />
			</div>
			<div>
				<h3 class="text-xs uppercase tracking-wider font-semibold text-surface-400">Proxy Configuration</h3>
			</div>
		</div>

		<div class="flex flex-col gap-5">
			<div class="flex flex-col gap-2">
				<label for="proxy-port" class="text-sm font-medium text-surface-300">Proxy Port</label>
				<input
					id="proxy-port"
					type="number"
					class="input max-w-xs rounded-lg bg-surface-800 border border-surface-700 text-surface-100 transition-colors duration-200"
					min="1024"
					max="65535"
					bind:value={portInput}
				/>
				<span class="text-xs text-surface-500">Port for the local proxy server (1024-65535)</span>
			</div>

			<div class="flex items-center gap-3">
				<Switch
					checked={autoStart}
					onCheckedChange={(details) => (autoStart = details.checked)}
				>
					<span class="text-sm text-surface-300">Auto-start proxy on launch</span>
				</Switch>
			</div>

			<div class="flex justify-end pt-2">
				<button
					class="btn rounded-lg bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:from-primary-500 hover:to-primary-400 transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
					onclick={saveSettings}
					disabled={saving}
				>
					{#if saving}
						<Loader2 size={16} class="animate-spin" />
					{:else}
						<Save size={16} />
					{/if}
					<span>Save Settings</span>
				</button>
			</div>
		</div>
	</div>

	<!-- License Info -->
	<div class="bg-surface-900 border border-surface-800 rounded-xl p-6">
		<div class="flex items-center gap-3 mb-6">
			<div class="p-2 rounded-lg bg-primary-500/10">
				<Shield size={18} class="text-primary-400" />
			</div>
			<div>
				<h3 class="text-xs uppercase tracking-wider font-semibold text-surface-400">License</h3>
			</div>
		</div>

		<div class="flex flex-col gap-5">
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div class="flex flex-col gap-1.5 p-3 rounded-lg bg-surface-800/50 border border-surface-800">
					<div class="flex items-center gap-2">
						<KeyRound size={14} class="text-surface-500" />
						<p class="text-xs text-surface-500">License Key</p>
					</div>
					<p class="text-sm font-mono text-surface-200">{maskKey(appState.licenseKey)}</p>
				</div>

				<div class="flex flex-col gap-1.5 p-3 rounded-lg bg-surface-800/50 border border-surface-800">
					<div class="flex items-center gap-2">
						<Shield size={14} class="text-surface-500" />
						<p class="text-xs text-surface-500">Plan</p>
					</div>
					<p class="text-sm text-surface-200">
						<span class="inline-flex items-center gap-1.5 bg-primary-500/10 text-primary-400 text-xs font-medium rounded-md px-2 py-0.5 border border-primary-500/20 capitalize">{appState.licensePlan}</span>
					</p>
				</div>

				<div class="flex flex-col gap-1.5 p-3 rounded-lg bg-surface-800/50 border border-surface-800">
					<div class="flex items-center gap-2">
						<Calendar size={14} class="text-surface-500" />
						<p class="text-xs text-surface-500">Expires</p>
					</div>
					<p class="text-sm text-surface-200">{formatExpiry(appState.licenseExpiresAt)}</p>
				</div>
			</div>

			<div class="border-t border-surface-800"></div>

			<div class="flex justify-end">
				<button
					class="btn rounded-lg bg-error-500/10 border border-error-500/20 text-error-400 hover:bg-error-500/20 transition-colors duration-200 cursor-pointer"
					onclick={() => (showDeactivateConfirm = true)}
				>
					<LogOut size={16} />
					<span>Deactivate License</span>
				</button>
			</div>
		</div>
	</div>

	<!-- About -->
	<div class="bg-surface-900 border border-surface-800 rounded-xl p-6">
		<div class="flex items-center gap-3 mb-6">
			<div class="p-2 rounded-lg bg-primary-500/10">
				<Info size={18} class="text-primary-400" />
			</div>
			<div>
				<h3 class="text-xs uppercase tracking-wider font-semibold text-surface-400">About</h3>
			</div>
		</div>

		<div class="flex items-center gap-4">
			<div class="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
				<Zap size={20} class="text-primary-400" />
			</div>
			<div>
				<p class="text-sm font-semibold text-surface-200">Xixero</p>
				<p class="text-xs text-surface-500">v0.1.0 &middot; Local AI Reverse Proxy</p>
			</div>
		</div>
	</div>
</div>

<!-- Deactivate Confirmation -->
{#if showDeactivateConfirm}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-surface-950/80 backdrop-blur-sm z-[998] flex items-center justify-center p-4 animate-fade-in"
		role="dialog"
		aria-modal="true"
		aria-label="Deactivate license confirmation"
		tabindex="-1"
		onkeydown={(e) => { if (e.key === 'Escape') showDeactivateConfirm = false; }}
	>
		<div class="bg-surface-900 border border-surface-800 rounded-xl p-6 max-w-sm w-full animate-slide-up">
			<h3 class="text-lg font-semibold text-surface-50 mb-2">Deactivate License</h3>
			<p class="text-sm text-surface-400 mb-6">
				This will unbind the license from this device. You can reactivate it later on any device.
			</p>
			<div class="flex justify-end gap-3">
				<button
					class="btn rounded-lg bg-surface-800 text-surface-300 hover:bg-surface-700 transition-colors duration-200 cursor-pointer"
					onclick={() => (showDeactivateConfirm = false)}
				>
					Cancel
				</button>
				<button
					class="btn rounded-lg preset-filled-error-500 cursor-pointer transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
					onclick={handleDeactivate}
					disabled={deactivating}
				>
					{#if deactivating}
						<Loader2 size={16} class="animate-spin" />
					{/if}
					<span>Deactivate</span>
				</button>
			</div>
		</div>
	</div>
{/if}
