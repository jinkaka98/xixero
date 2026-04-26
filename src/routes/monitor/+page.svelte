<script lang="ts">
	import { trafficState } from '$lib/stores.svelte.js';
	import { Activity, Trash2 } from 'lucide-svelte';

	function statusColor(status: number): string {
		if (status >= 200 && status < 300) return 'bg-green-500/15 text-green-400 border border-green-500/20';
		if (status >= 400 && status < 500) return 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20';
		if (status >= 500) return 'bg-red-500/15 text-red-400 border border-red-500/20';
		return 'bg-surface-800 text-surface-400 border border-surface-700';
	}

	function methodColor(method: string): string {
		switch (method.toUpperCase()) {
			case 'GET': return 'text-blue-400';
			case 'POST': return 'text-green-400';
			case 'PUT': return 'text-yellow-400';
			case 'DELETE': return 'text-red-400';
			case 'PATCH': return 'text-orange-400';
			default: return 'text-surface-400';
		}
	}

	function formatTime(date: Date): string {
		return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	function formatLatency(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	}
</script>

<div class="flex flex-col gap-6 animate-slide-up">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-surface-50">Traffic Monitor</h2>
			<p class="text-sm text-surface-400">Real-time view of proxy traffic.</p>
		</div>
		<button
			class="btn rounded-lg bg-surface-800 border border-surface-700 text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
			onclick={() => trafficState.clear()}
			disabled={trafficState.entries.length === 0}
		>
			<Trash2 size={16} />
			<span>Clear</span>
		</button>
	</div>

	<!-- Traffic Table -->
	{#if trafficState.entries.length === 0}
		<div class="bg-surface-900 border border-surface-800 rounded-xl p-12 text-center">
			<div class="flex flex-col items-center gap-3">
				<div class="p-4 rounded-xl bg-surface-800">
					<Activity size={32} class="text-surface-500" />
				</div>
				<h3 class="text-lg font-semibold text-surface-300">No Traffic</h3>
				<p class="text-sm text-surface-500">Traffic will appear here when requests flow through the proxy.</p>
			</div>
		</div>
	{:else}
		<div class="bg-surface-900 border border-surface-800 rounded-xl overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead>
						<tr class="border-b border-surface-800">
							<th class="text-left text-[11px] uppercase tracking-wider text-surface-500 font-medium px-4 py-3">Time</th>
							<th class="text-left text-[11px] uppercase tracking-wider text-surface-500 font-medium px-4 py-3">Method</th>
							<th class="text-left text-[11px] uppercase tracking-wider text-surface-500 font-medium px-4 py-3">Path</th>
							<th class="text-left text-[11px] uppercase tracking-wider text-surface-500 font-medium px-4 py-3">Provider</th>
							<th class="text-left text-[11px] uppercase tracking-wider text-surface-500 font-medium px-4 py-3">Status</th>
							<th class="text-right text-[11px] uppercase tracking-wider text-surface-500 font-medium px-4 py-3">Latency</th>
						</tr>
					</thead>
					<tbody>
						{#each trafficState.entries as entry (entry.id)}
							<tr class="border-b border-surface-800/50 hover:bg-surface-800/30 transition-colors duration-200">
								<td class="px-4 py-3 text-xs text-surface-500 font-mono whitespace-nowrap">{formatTime(entry.timestamp)}</td>
								<td class="px-4 py-3">
									<span class="text-xs font-mono font-bold {methodColor(entry.method)}">{entry.method}</span>
								</td>
								<td class="px-4 py-3">
									<code class="text-xs font-mono text-surface-300">{entry.path}</code>
								</td>
								<td class="px-4 py-3 text-xs text-surface-300">{entry.provider}</td>
								<td class="px-4 py-3">
									<span class="inline-flex text-[11px] font-mono font-medium rounded-md px-2 py-0.5 {statusColor(entry.status)}">{entry.status}</span>
								</td>
								<td class="px-4 py-3 text-xs text-surface-500 font-mono text-right whitespace-nowrap">{formatLatency(entry.latency)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
		<p class="text-xs text-surface-500 text-right">
			Showing {trafficState.entries.length} entries (max 200)
		</p>
	{/if}
</div>
