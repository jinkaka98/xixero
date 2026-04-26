<script lang="ts">
	import { configState } from '$lib/stores.svelte.js';
	import { commands } from '$lib/tauri.js';
	import type { ProviderConfig } from '$lib/tauri.js';
	import { Switch } from '@skeletonlabs/skeleton-svelte';
	import {
		Plus,
		Pencil,
		Trash2,
		Server,
		X,
		Loader2,
		Globe,
		Key,
		Cpu
	} from 'lucide-svelte';

	// ── State ──────────────────────────────────────────────────────────
	let showForm = $state(false);
	let editingId = $state<string | null>(null);
	let saving = $state(false);
	let deleteConfirmId = $state<string | null>(null);

	// Form fields
	let formName = $state('');
	let formBaseUrl = $state('');
	let formApiKey = $state('');
	let formModels = $state('');
	let formEnabled = $state(true);

	// Provider templates
	const templates = [
		{ name: 'OpenAI', base_url: 'https://api.openai.com/v1', models: 'gpt-4o,gpt-4o-mini,gpt-4-turbo,gpt-3.5-turbo' },
		{ name: 'Anthropic', base_url: 'https://api.anthropic.com/v1', models: 'claude-sonnet-4-20250514,claude-3-5-haiku-20241022,claude-3-opus-20240229' },
		{ name: 'Google AI', base_url: 'https://generativelanguage.googleapis.com/v1beta', models: 'gemini-2.0-flash,gemini-1.5-pro' },
		{ name: 'Custom', base_url: '', models: '' }
	];

	// ── Helpers ─────────────────────────────────────────────────────────
	function generateId(): string {
		return crypto.randomUUID();
	}

	function openAddForm(template?: (typeof templates)[number]) {
		editingId = null;
		formName = template?.name === 'Custom' ? '' : (template?.name ?? '');
		formBaseUrl = template?.base_url ?? '';
		formApiKey = '';
		formModels = template?.models ?? '';
		formEnabled = true;
		showForm = true;
	}

	function openEditForm(provider: ProviderConfig) {
		editingId = provider.id;
		formName = provider.name;
		formBaseUrl = provider.base_url;
		formApiKey = provider.api_key;
		formModels = provider.models.join(',');
		formEnabled = provider.enabled;
		showForm = true;
	}

	function closeForm() {
		showForm = false;
		editingId = null;
	}

	async function saveProvider() {
		saving = true;
		try {
			const provider: ProviderConfig = {
				id: editingId ?? generateId(),
				name: formName.trim(),
				base_url: formBaseUrl.trim(),
				api_key: formApiKey.trim(),
				models: formModels
					.split(',')
					.map((m) => m.trim())
					.filter(Boolean),
				enabled: formEnabled
			};

			if (editingId) {
				configState.updateProvider(editingId, provider);
			} else {
				configState.addProvider(provider);
			}

			await commands.saveConfig(configState.toAppConfig());
			await commands.updateProxyConfig();
			closeForm();
		} catch (err) {
			console.error('Failed to save provider:', err);
		} finally {
			saving = false;
		}
	}

	async function deleteProvider(id: string) {
		try {
			configState.removeProvider(id);
			await commands.saveConfig(configState.toAppConfig());
			await commands.updateProxyConfig();
		} catch (err) {
			console.error('Failed to delete provider:', err);
		}
		deleteConfirmId = null;
	}

	async function toggleProvider(provider: ProviderConfig) {
		const updated = { ...provider, enabled: !provider.enabled };
		configState.updateProvider(provider.id, updated);
		try {
			await commands.saveConfig(configState.toAppConfig());
			await commands.updateProxyConfig();
		} catch (err) {
			console.error('Failed to toggle provider:', err);
		}
	}
</script>

<div class="flex flex-col gap-6 animate-slide-up">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-surface-50">Providers</h2>
			<p class="text-sm text-surface-400">Configure your AI provider backends.</p>
		</div>
		<button
			class="btn rounded-lg font-medium bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:from-primary-500 hover:to-primary-400 transition-colors duration-200 cursor-pointer"
			onclick={() => openAddForm()}
		>
			<Plus size={16} />
			<span>Add Provider</span>
		</button>
	</div>

	<!-- Template Quick-Add -->
	<div class="flex flex-wrap gap-2">
		{#each templates as template}
			<button
				class="btn btn-sm rounded-lg bg-surface-800 border border-surface-700 text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-colors duration-200 cursor-pointer"
				onclick={() => openAddForm(template)}
			>
				<Plus size={14} />
				<span>{template.name}</span>
			</button>
		{/each}
	</div>

	<!-- Provider List -->
	{#if configState.providers.length === 0}
		<div class="bg-surface-900 border border-surface-800 rounded-xl p-12 text-center">
			<div class="flex flex-col items-center gap-3">
				<div class="p-4 rounded-xl bg-surface-800">
					<Server size={32} class="text-surface-500" />
				</div>
				<h3 class="text-lg font-semibold text-surface-300">No Providers</h3>
				<p class="text-sm text-surface-500">Add a provider to get started.</p>
			</div>
		</div>
	{:else}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
			{#each configState.providers as provider (provider.id)}
				<div class="bg-surface-900 border border-surface-800 rounded-xl p-6 transition-colors duration-200 hover:border-surface-700">
					<div class="flex items-start justify-between gap-4">
						<div class="flex items-start gap-3 flex-1 min-w-0">
							<div class="p-2.5 rounded-xl bg-surface-800 shrink-0 mt-0.5">
								<Server size={18} class="transition-colors duration-200 {provider.enabled ? 'text-primary-400' : 'text-surface-500'}" />
							</div>
							<div class="min-w-0 flex-1">
								<h3 class="font-semibold text-surface-50 truncate">{provider.name}</h3>
								<p class="text-xs text-surface-500 truncate mt-0.5">{provider.base_url}</p>
								<div class="flex flex-wrap gap-1.5 mt-2">
									{#each provider.models.slice(0, 3) as model}
										<span class="text-[10px] font-mono bg-surface-800 border border-surface-700 rounded px-1.5 py-0.5 text-surface-400">{model}</span>
									{/each}
									{#if provider.models.length > 3}
										<span class="text-[10px] font-mono bg-surface-800 border border-surface-700 rounded px-1.5 py-0.5 text-surface-400">+{provider.models.length - 3}</span>
									{/if}
								</div>
							</div>
						</div>
						<div class="flex items-center gap-2 shrink-0">
							<Switch
								checked={provider.enabled}
								onCheckedChange={() => toggleProvider(provider)}
							>
							</Switch>
							<button
								class="p-2 rounded-lg hover:bg-surface-800 transition-colors duration-200 cursor-pointer text-surface-400 hover:text-surface-200"
								onclick={() => openEditForm(provider)}
								title="Edit provider"
							>
								<Pencil size={14} />
							</button>
							<button
								class="p-2 rounded-lg hover:bg-error-500/10 transition-colors duration-200 cursor-pointer text-surface-400 hover:text-error-400"
								onclick={() => (deleteConfirmId = provider.id)}
								title="Delete provider"
							>
								<Trash2 size={14} />
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Delete Confirmation Modal -->
{#if deleteConfirmId}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-surface-950/80 backdrop-blur-sm z-[998] flex items-center justify-center p-4 animate-fade-in"
		role="dialog"
		aria-modal="true"
		aria-label="Delete provider confirmation"
		tabindex="-1"
		onkeydown={(e) => { if (e.key === 'Escape') deleteConfirmId = null; }}
	>
		<div class="bg-surface-900 border border-surface-800 rounded-xl p-6 max-w-sm w-full animate-slide-up">
			<h3 class="text-lg font-semibold text-surface-50 mb-2">Delete Provider</h3>
			<p class="text-sm text-surface-400 mb-6">Are you sure? This action cannot be undone.</p>
			<div class="flex justify-end gap-3">
				<button
					class="btn rounded-lg bg-surface-800 text-surface-300 hover:bg-surface-700 transition-colors duration-200 cursor-pointer"
					onclick={() => (deleteConfirmId = null)}
				>
					Cancel
				</button>
				<button
					class="btn rounded-lg preset-filled-error-500 cursor-pointer transition-colors duration-200"
					onclick={() => deleteProvider(deleteConfirmId!)}
				>
					Delete
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Add/Edit Form Modal -->
{#if showForm}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-surface-950/80 backdrop-blur-sm z-[998] flex items-center justify-center p-4 animate-fade-in"
		role="dialog"
		aria-modal="true"
		aria-label="{editingId ? 'Edit' : 'Add'} provider"
		tabindex="-1"
		onkeydown={(e) => { if (e.key === 'Escape') closeForm(); }}
	>
		<div class="bg-surface-900 border border-surface-800 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-slide-up">
			<div class="flex items-center justify-between mb-6">
				<h3 class="text-lg font-semibold text-surface-50">{editingId ? 'Edit Provider' : 'Add Provider'}</h3>
				<button
					class="p-2 rounded-lg hover:bg-surface-800 transition-colors duration-200 cursor-pointer text-surface-400 hover:text-surface-200"
					onclick={closeForm}
					title="Close"
				>
					<X size={16} />
				</button>
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					saveProvider();
				}}
				class="flex flex-col gap-4"
			>
				<div class="flex flex-col gap-2">
					<label for="provider-name" class="text-sm font-medium text-surface-300 flex items-center gap-1.5">
						<Server size={14} /> Name
					</label>
					<input
						id="provider-name"
						type="text"
						class="input rounded-lg bg-surface-800 border border-surface-700 text-surface-100 placeholder:text-surface-600 transition-colors duration-200"
						placeholder="e.g. OpenAI"
						bind:value={formName}
						required
					/>
				</div>

				<div class="flex flex-col gap-2">
					<label for="provider-url" class="text-sm font-medium text-surface-300 flex items-center gap-1.5">
						<Globe size={14} /> Base URL
					</label>
					<input
						id="provider-url"
						type="url"
						class="input rounded-lg bg-surface-800 border border-surface-700 text-surface-100 placeholder:text-surface-600 transition-colors duration-200"
						placeholder="https://api.openai.com/v1"
						bind:value={formBaseUrl}
						required
					/>
				</div>

				<div class="flex flex-col gap-2">
					<label for="provider-key" class="text-sm font-medium text-surface-300 flex items-center gap-1.5">
						<Key size={14} /> API Key
					</label>
					<input
						id="provider-key"
						type="password"
						class="input rounded-lg bg-surface-800 border border-surface-700 text-surface-100 placeholder:text-surface-600 transition-colors duration-200"
						placeholder="sk-..."
						bind:value={formApiKey}
						required
					/>
				</div>

				<div class="flex flex-col gap-2">
					<label for="provider-models" class="text-sm font-medium text-surface-300 flex items-center gap-1.5">
						<Cpu size={14} /> Models
					</label>
					<input
						id="provider-models"
						type="text"
						class="input rounded-lg bg-surface-800 border border-surface-700 text-surface-100 placeholder:text-surface-600 transition-colors duration-200"
						placeholder="gpt-4o, gpt-4o-mini"
						bind:value={formModels}
					/>
					<span class="text-xs text-surface-500">Comma-separated list of model names</span>
				</div>

				<div class="flex items-center gap-3">
					<Switch checked={formEnabled} onCheckedChange={(details) => (formEnabled = details.checked)}>
						<span class="text-sm text-surface-300">Enabled</span>
					</Switch>
				</div>

				<div class="flex justify-end gap-3 mt-2">
					<button
						type="button"
						class="btn rounded-lg bg-surface-800 text-surface-300 hover:bg-surface-700 transition-colors duration-200 cursor-pointer"
						onclick={closeForm}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="btn rounded-lg bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:from-primary-500 hover:to-primary-400 transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
						disabled={saving}
					>
						{#if saving}
							<Loader2 size={16} class="animate-spin" />
						{/if}
						<span>{editingId ? 'Update' : 'Add'} Provider</span>
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
