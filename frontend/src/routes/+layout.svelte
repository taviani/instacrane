<script lang="ts">
	import '../app.css';
	import Navbar from '$lib/components/Navbar.svelte';
	import { getAuth } from '$lib/stores/auth.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	const auth = getAuth();

	$effect(() => {
		auth.init();
	});
</script>

{#if auth.loading}
	<div class="loading-screen">
		<p>Chargement...</p>
	</div>
{:else}
	<Navbar />
	<main class="main-content">
		{@render children()}
	</main>
{/if}

<style>
	.loading-screen {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100vh;
		color: var(--text-secondary);
	}

	.main-content {
		margin-top: var(--nav-height);
		min-height: calc(100vh - var(--nav-height));
	}
</style>
