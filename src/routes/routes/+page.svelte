<script lang="ts">
	import { configState } from '$lib/stores.svelte.js';
	import { commands } from '$lib/tauri.js';
	import type { RouteConfig } from '$lib/tauri.js';
	import { Switch } from '@skeletonlabs/skeleton-svelte';
	import {
		Plus,
		Pencil,
		Trash2,
		Route,
		X,
		Loader2,
		ArrowRight,
		Minus
	} from 'lucide-svelte';

	// ── State ──────────────────────────────────────────────────────────
	let showForm = $state(false);
	let editingId = $state<string | null>(null);
	let saving = $state(false);
	let deleteConfirmId = $state<string | null>(null);

	// Form fields
	let formName = $state('');
	let formPathPattern = $state('');
	let formTargetProvider = $state('');
	let formModelMappings = $state<{ from: string; to: string }[]>([]);
	let formEnabled = $state(true);

	// ── Helpers ─────────────────────────────────────────────────────────
	function generateId(): string {
		return crypto.randomUUID();
	}

	function openAddForm() {
		editingId = null;
		formName = '';
		formPathPattern = '';
		formTargetProvider = configState.providers[0]?.id ?? '';
		formModelMappings = [{ from: '', to: '' }];
		formEnabled = true;
		showForm = true;
	}

	function openEditForm(route: RouteConfig) {
		editingId = route.id;
		formName = route.name;
		formPathPattern = route.path_pattern;
		formTargetProvider = route.target_provider;
		formModelMappings = Object.entries(route.model_mapping).map(([from, to]) => ({ from, to }));
		if (formModelMappings.length === 0) formModelMappings = [{ from: '', to: '' }];
		formEnabled = route.enabled;
		showForm = true;
	}

	function closeForm() {
		showForm = false;
		editingId = null;
	}

	function addMappingRow() {
		formModelMappings = [...formModelMappings, { from: '', to: '' }];
	}

	function removeMappingRow(index: number) {
		formModelMappings = formModelMappings.filter((_, i) => i !== index);
	}

	async function saveRoute() {
		saving = true;
		try {
			const modelMapping: Record<string, string> = {};
			for (const m of formModelMappings) {
				if (m.from.trim() && m.to.trim()) {
					modelMapping[m.from.trim()] = m.to.trim();
				}
			}

			const route: RouteConfig = {
				id: editingId ?? generateId(),
				name: formName.trim(),
				path_pattern: formPathPattern.trim(),
				target_provider: formTargetProvider,
				model_mapping: modelMapping,
				enabled: formEnabled
			};

			if (editingId) {
				configState.updateRoute(editingId, route);
			} else {
				configState.addRoute(route);
			}

			await commands.saveConfig(configState.toAppConfig());
			await commands.updateProxyConfig();
			closeForm();
		} catch (err) {
			console.error('Failed to save route:', err);
		} finally {
			saving = false;
		}
	}

	async function deleteRoute(id: string) {
		try {
			configState.removeRoute(id);
			await commands.saveConfig(configState.toAppConfig());
			await commands.updateProxyConfig();
		} catch (err) {
			console.error('Failed to delete route:', err);
		}
		deleteConfirmId = null;
	}

	async function toggleRoute(route: RouteConfig) {
		const updated = { ...route, enabled: !route.enabled };
		configState.updateRoute(route.id, updated);
		try {
			await commands.saveConfig(configState.toAppConfig());
			await commands.updateProxyConfig();
		} catch (err) {
			console.error('Failed to toggle route:', err);
		}
	}

	function getProviderName(id: string): string {
		return configState.providers.find((p) => p.id === id)?.name ?? 'Unknown';
	}
</script>

<div class="flex flex-col gap-6 animate-slide-up">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-surface-50">Routes</h2>
			<p class="text-sm text-surface-400">Define how requests are routed to providers.</p>
		</div>
		<button
			class="btn rounded-lg font-medium bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:from-primary-500 hover:to-primary-400 transition-colors duration-200 cursor-pointer"
			onclick={openAddForm}
		>
			<Plus size={16} />
			<span>Add Route</span>
		</button>
	</div>

	<!-- Route List -->
	{#if configState.routes.length === 0}
		<div class="bg-surface-900 border border-surface-800 rounded-xl p-12 text-center">
			<div class="flex flex-col items-center gap-3">
				<div class="p-4 rounded-xl bg-surface-800">
					<Route size={32} class="text-surface-500" />
				</div>
				<h3 class="text-lg font-semibold text-surface-300">No Routes</h3>
				<p class="text-sm text-surface-500">Create a route to start directing traffic.</p>
			</div>
		</div>
	{:else}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
			{#each configState.routes as route (route.id)}
				<div class="bg-surface-900 border border-surface-800 rounded-xl p-6 transition-colors duration-200 hover:border-surface-700">
					<div class="flex items-start justify-between gap-4">
						<div class="flex items-start gap-3 flex-1 min-w-0">
							<div class="p-2.5 rounded-xl bg-surface-800 shrink-0 mt-0.5">
								<Route size={18} class="transition-colors duration-200 {route.enabled ? 'text-primary-400' : 'text-surface-500'}" />
							</div>
							<div class="min-w-0 flex-1">
								<h3 class="font-semibold text-surface-50 truncate">{route.name}</h3>
								<div class="flex items-center gap-2 text-xs text-surface-400 mt-1">
									<code class="font-mono text-[11px] bg-surface-800 border border-surface-700 rounded px-1.5 py-0.5 text-surface-300">{route.path_pattern}</code>
									<ArrowRight size={12} class="text-surface-600 shrink-0" />
									<span class="text-surface-300 truncate">{getProviderName(route.target_provider)}</span>
								</div>
								{#if Object.keys(route.model_mapping).length > 0}
									<div class="flex flex-wrap gap-1.5 mt-2">
										{#each Object.entries(route.model_mapping).slice(0, 2) as [from, to]}
											<span class="text-[10px] font-mono bg-surface-800 border border-surface-700 rounded px-1.5 py-0.5 text-surface-400">{from} &rarr; {to}</span>
										{/each}
										{#if Object.keys(route.model_mapping).length > 2}
											<span class="text-[10px] font-mono bg-surface-800 border border-surface-700 rounded px-1.5 py-0.5 text-surface-400">
												+{Object.keys(route.model_mapping).length - 2} more
											</span>
										{/if}
									</div>
								{/if}
							</div>
						</div>
						<div class="flex items-center gap-2 shrink-0">
							<Switch
								checked={route.enabled}
								onCheckedChange={() => toggleRoute(route)}
							>
							</Switch>
							<button
								class="p-2 rounded-lg hover:bg-surface-800 transition-colors duration-200 cursor-pointer text-surface-400 hover:text-surface-200"
								onclick={() => openEditForm(route)}
								title="Edit route"
							>
								<Pencil size={14} />
							</button>
							<button
								class="p-2 rounded-lg hover:bg-error-500/10 transition-colors duration-200 cursor-pointer text-surface-400 hover:text-error-400"
								onclick={() => (deleteConfirmId = route.id)}
								title="Delete route"
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

<!-- Delete Confirmation -->
{#if deleteConfirmId}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-surface-950/80 backdrop-blur-sm z-[998] flex items-center justify-center p-4 animate-fade-in"
		role="dialog"
		aria-modal="true"
		aria-label="Delete route confirmation"
		tabindex="-1"
		onkeydown={(e) => { if (e.key === 'Escape') deleteConfirmId = null; }}
	>
		<div class="bg-surface-900 border border-surface-800 rounded-xl p-6 max-w-sm w-full animate-slide-up">
			<h3 class="text-lg font-semibold text-surface-50 mb-2">Delete Route</h3>
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
					onclick={() => deleteRoute(deleteConfirmId!)}
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
		aria-label="{editingId ? 'Edit' : 'Add'} route"
		tabindex="-1"
		onkeydown={(e) => { if (e.key === 'Escape') closeForm(); }}
	>
		<div class="bg-surface-900 border border-surface-800 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-slide-up">
			<div class="flex items-center justify-between mb-6">
				<h3 class="text-lg font-semibold text-surface-50">{editingId ? 'Edit Route' : 'Add Route'}</h3>
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
					saveRoute();
				}}
				class="flex flex-col gap-4"
			>
				<div class="flex flex-col gap-2">
					<label for="route-name" class="text-sm font-medium text-surface-300">Route Name</label>
					<input
						id="route-name"
						type="text"
						class="input rounded-lg bg-surface-800 border border-surface-700 text-surface-100 placeholder:text-surface-600 transition-colors duration-200"
						placeholder="e.g. OpenAI Chat"
						bind:value={formName}
						required
					/>
				</div>

				<div class="flex flex-col gap-2">
					<label for="route-pattern" class="text-sm font-medium text-surface-300">Path Pattern</label>
					<input
						id="route-pattern"
						type="text"
						class="input rounded-lg bg-surface-800 border border-surface-700 text-surface-100 font-mono placeholder:text-surface-600 transition-colors duration-200"
						placeholder="/v1/chat/completions"
						bind:value={formPathPattern}
						required
					/>
					<span class="text-xs text-surface-500">e.g. /v1/chat/completions, /v1/*, /api/**</span>
				</div>

				<div class="flex flex-col gap-2">
					<label for="route-provider" class="text-sm font-medium text-surface-300">Target Provider</label>
					<select
						id="route-provider"
						class="select rounded-lg bg-surface-800 border border-surface-700 text-surface-100 transition-colors duration-200 cursor-pointer"
						bind:value={formTargetProvider}
						required
					>
						<option value="" disabled>Select a provider</option>
						{#each configState.providers as provider}
							<option value={provider.id}>{provider.name}</option>
						{/each}
					</select>
				</div>

				<!-- Model Mappings -->
				<div class="flex flex-col gap-3">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-surface-300">Model Mapping</span>
						<button
							type="button"
							class="btn btn-sm rounded-lg bg-surface-800 border border-surface-700 text-surface-300 hover:bg-surface-700 transition-colors duration-200 cursor-pointer"
							onclick={addMappingRow}
						>
							<Plus size={12} />
							<span>Add</span>
						</button>
					</div>
					<span class="text-xs text-surface-500">Map incoming model names to provider-specific models</span>
					{#each formModelMappings as mapping, i}
						<div class="flex items-center gap-2">
							<input
								type="text"
								class="input flex-1 rounded-lg bg-surface-800 border border-surface-700 text-surface-100 font-mono text-sm placeholder:text-surface-600 transition-colors duration-200"
								placeholder="From model"
								bind:value={mapping.from}
							/>
							<ArrowRight size={16} class="text-surface-600 shrink-0" />
							<input
								type="text"
								class="input flex-1 rounded-lg bg-surface-800 border border-surface-700 text-surface-100 font-mono text-sm placeholder:text-surface-600 transition-colors duration-200"
								placeholder="To model"
								bind:value={mapping.to}
							/>
							{#if formModelMappings.length > 1}
								<button
									type="button"
									class="p-2 rounded-lg hover:bg-error-500/10 transition-colors duration-200 cursor-pointer text-surface-400 hover:text-error-400 shrink-0"
									onclick={() => removeMappingRow(i)}
									title="Remove mapping"
								>
									<Minus size={14} />
								</button>
							{/if}
						</div>
					{/each}
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
						<span>{editingId ? 'Update' : 'Add'} Route</span>
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
