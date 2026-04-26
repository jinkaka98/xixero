<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { uiState, proxyState } from '$lib/stores.svelte.js';
	import {
		LayoutDashboard,
		Server,
		Route,
		Activity,
		Settings,
		PanelLeftClose,
		PanelLeft,
		Zap,
		Circle
	} from 'lucide-svelte';

	const navItems = [
		{ id: '/', label: 'Dashboard', icon: LayoutDashboard },
		{ id: '/providers', label: 'Providers', icon: Server },
		{ id: '/routes', label: 'Routes', icon: Route },
		{ id: '/monitor', label: 'Monitor', icon: Activity },
		{ id: '/settings', label: 'Settings', icon: Settings }
	];

	let currentPath = $derived(page.url?.pathname ?? '/');
	let collapsed = $derived(uiState.sidebarCollapsed);
</script>

<aside
	class="flex flex-col h-screen bg-surface-900 border-r border-surface-800 no-select shrink-0 transition-all duration-200 ease-in-out"
	style="width: {collapsed ? '64px' : '224px'};"
>
	<!-- Logo Section -->
	<div class="flex items-center h-14 px-3 shrink-0">
		{#if collapsed}
			<div class="flex items-center justify-center w-full">
				<div class="p-1.5 rounded-lg bg-primary-500/15 border border-primary-500/20">
					<Zap size={20} class="text-primary-400" />
				</div>
			</div>
		{:else}
			<div class="flex items-center gap-3 px-1">
				<div class="p-1.5 rounded-lg bg-primary-500/15 border border-primary-500/20 shrink-0">
					<Zap size={20} class="text-primary-400" />
				</div>
				<span class="font-bold text-lg text-surface-50 truncate">Xixero</span>
			</div>
		{/if}
	</div>

	<!-- Separator -->
	<div class="mx-3 border-t border-surface-800"></div>

	<!-- Navigation -->
	<nav class="flex flex-col gap-1 p-2 flex-1 mt-1">
		{#each navItems as item (item.id)}
			{@const isActive = currentPath === item.id}
			<button
				class="flex items-center gap-3 rounded-lg transition-colors duration-200 cursor-pointer
					{collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'}
					{isActive
						? 'bg-primary-500/15 text-primary-400'
						: 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'}"
				onclick={() => goto(item.id)}
				aria-current={isActive ? 'page' : undefined}
				title={collapsed ? item.label : undefined}
			>
				<item.icon size={20} class="shrink-0" />
				{#if !collapsed}
					<span class="text-sm font-medium truncate">{item.label}</span>
				{/if}
			</button>
		{/each}
	</nav>

	<!-- Separator -->
	<div class="mx-3 border-t border-surface-800"></div>

	<!-- Footer: Proxy Status -->
	<div class="flex items-center gap-2.5 px-3 py-2.5 {collapsed ? 'justify-center' : ''}">
		<div class="relative shrink-0">
			<Circle
				size={8}
				fill={proxyState.running ? '#22c55e' : '#6b7280'}
				class="{proxyState.running ? 'text-green-500' : 'text-gray-500'} {proxyState.running ? 'animate-pulse-dot' : ''}"
			/>
		</div>
		{#if !collapsed}
			<span class="text-xs text-surface-400 truncate">
				{proxyState.running ? `Port ${proxyState.port}` : 'Offline'}
			</span>
		{/if}
	</div>

	<!-- Collapse Toggle -->
	<div class="p-2 shrink-0">
		<button
			class="flex items-center justify-center gap-2 w-full rounded-lg py-2 text-surface-400 hover:bg-surface-800 hover:text-surface-200 transition-colors duration-200 cursor-pointer"
			onclick={() => uiState.toggleSidebar()}
			title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
		>
			{#if collapsed}
				<PanelLeft size={18} />
			{:else}
				<PanelLeftClose size={18} />
				<span class="text-xs">Collapse</span>
			{/if}
		</button>
	</div>
</aside>
