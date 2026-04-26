<script lang="ts">
	import logoPng from '$lib/assets/logo.png';

	let { size = 32, class: className = '' }: { size?: number; class?: string } = $props();
</script>

<img src={logoPng} alt="Xixero" width={size} height={size} class="rounded-xl {className}" draggable="false" />
