<script lang="ts">
	import { appState } from '$lib/stores.svelte.js';
	import { validateLicense } from '$lib/license.js';
	import {
		KeyRound,
		Loader2,
		AlertCircle,
		WifiOff,
		ArrowRight,
		Globe,
		Cpu,
		Shield,
		Fingerprint,
		Wifi
	} from 'lucide-svelte';
	import Logo from '$lib/components/Logo.svelte';

	let inputKey = $state('');

	async function handleSubmit(e: Event) {
		e.preventDefault();
		const key = inputKey.trim();
		if (!key) return;
		await validateLicense(key);
	}

	let isNetworkError = $derived(
		appState.error.toLowerCase().includes('network') ||
		appState.error.toLowerCase().includes('offline') ||
		appState.error.toLowerCase().includes('fetch')
	);

	// Auto-validate saved key on mount
	$effect(() => {
		const saved = appState.licenseKey;
		if (saved && !appState.isLicensed && !appState.isValidating) {
			inputKey = saved;
			validateLicense(saved);
		}
	});
</script>

<div class="flex h-screen w-screen animate-fade-in no-select">
	<!-- Left Panel: Branding -->
	<div class="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface-950">
		<!-- Animated gradient orbs -->
		<div class="orb-1" style="top: 15%; left: 10%;"></div>
		<div class="orb-2" style="top: 60%; right: 10%;"></div>
		<div class="orb-3" style="bottom: 10%; left: 30%;"></div>

		<div class="relative z-10 flex flex-col items-center justify-center w-full p-12">
			<div class="flex flex-col items-center gap-8 max-w-md text-center">
				<!-- Logo -->
				<Logo size={80} class="rounded-2xl" />

				<div class="flex flex-col gap-3">
					<h1 class="text-4xl font-bold tracking-tight text-surface-50">Xixero</h1>
					<p class="text-surface-400 text-lg leading-relaxed">
						Local AI Reverse Proxy for routing, managing, and monitoring your provider traffic.
					</p>
				</div>

				<!-- Feature items -->
				<div class="flex flex-col gap-4 mt-4 w-full max-w-xs">
					<div class="flex items-center gap-4 text-left">
						<div class="p-2.5 rounded-xl bg-surface-800/80 border border-surface-700/50 shrink-0">
							<Globe size={20} class="text-primary-400" />
						</div>
						<div>
							<p class="text-sm font-medium text-surface-200">Multi-Provider</p>
							<p class="text-xs text-surface-500">Connect OpenAI, Anthropic, Google & more</p>
						</div>
					</div>

					<div class="flex items-center gap-4 text-left">
						<div class="p-2.5 rounded-xl bg-surface-800/80 border border-surface-700/50 shrink-0">
							<Cpu size={20} class="text-secondary-400" />
						</div>
						<div>
							<p class="text-sm font-medium text-surface-200">Model Routing</p>
							<p class="text-xs text-surface-500">Smart path-based request routing</p>
						</div>
					</div>

					<div class="flex items-center gap-4 text-left">
						<div class="p-2.5 rounded-xl bg-surface-800/80 border border-surface-700/50 shrink-0">
							<Shield size={20} class="text-tertiary-400" />
						</div>
						<div>
							<p class="text-sm font-medium text-surface-200">Secure & Local</p>
							<p class="text-xs text-surface-500">Everything runs on your machine</p>
						</div>
					</div>
				</div>

				<!-- Version -->
				<p class="text-xs text-surface-600 mt-8">v0.1.0</p>
			</div>
		</div>
	</div>

	<!-- Right Panel: License Form -->
	<div class="flex-1 flex flex-col items-center justify-center bg-surface-950 p-8">
		<div class="w-full max-w-sm flex flex-col gap-8 animate-slide-up">
			<!-- Mobile logo -->
			<div class="flex lg:hidden flex-col items-center gap-3 mb-4">
				<Logo size={56} class="rounded-2xl" />
				<h1 class="text-2xl font-bold text-surface-50">Xixero</h1>
			</div>

			<!-- Heading -->
			<div class="flex flex-col gap-2">
				<h2 class="text-xl font-semibold text-surface-50">Activate License</h2>
				<p class="text-sm text-surface-400">Enter your license key to unlock the application.</p>
			</div>

			<!-- Form -->
			<form onsubmit={handleSubmit} class="flex flex-col gap-5">
				<div class="flex flex-col gap-2">
					<label for="license-key" class="text-sm font-medium text-surface-300">License Key</label>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none">
							<KeyRound size={18} />
						</span>
						<input
							id="license-key"
							type="text"
							class="input pl-10 font-mono uppercase tracking-wider rounded-lg bg-surface-900 border border-surface-800 text-surface-100 placeholder:text-surface-600 focus:ring-2 focus:ring-primary-500/30 transition-colors duration-200"
							placeholder="XXXX-XXXX-XXXX-XXXX"
							bind:value={inputKey}
							disabled={appState.isValidating}
							autocomplete="off"
							spellcheck="false"
						/>
					</div>
				</div>

				{#if appState.error}
					<div class="flex items-start gap-2.5 text-sm text-error-400 bg-error-500/10 border border-error-500/20 rounded-lg p-3">
						{#if isNetworkError}
							<WifiOff size={16} class="shrink-0 mt-0.5" />
						{:else}
							<AlertCircle size={16} class="shrink-0 mt-0.5" />
						{/if}
						<span>{appState.error}</span>
					</div>
				{/if}

				<button
					type="submit"
					class="btn w-full rounded-lg font-medium bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:from-primary-500 hover:to-primary-400 transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed glow-primary-sm"
					disabled={appState.isValidating || !inputKey.trim()}
				>
					{#if appState.isValidating}
						<Loader2 size={18} class="animate-spin" />
						<span>Validating...</span>
					{:else}
						<span>Activate</span>
						<ArrowRight size={18} />
					{/if}
				</button>
			</form>

			<!-- Trust badges -->
			<div class="flex items-center justify-center gap-6 pt-2">
				<div class="flex items-center gap-1.5 text-xs text-surface-500">
					<Fingerprint size={14} />
					<span>HWID Locked</span>
				</div>
				<div class="flex items-center gap-1.5 text-xs text-surface-500">
					<Wifi size={14} />
					<span>Online Validation</span>
				</div>
			</div>
		</div>
	</div>
</div>
