<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';
	import PostCard from '$lib/components/PostCard.svelte';
	import { getAuth } from '$lib/stores/auth.svelte';

	const auth = getAuth();
	let post = $state<any>(null);
	let loading = $state(true);
	let error = $state('');

	$effect(() => {
		if (!auth.loading && !auth.isLoggedIn) {
			goto('/auth');
			return;
		}
		const id = $page.params.id;
		if (id && auth.isLoggedIn) loadPost(id);
	});

	async function loadPost(id: string) {
		loading = true;
		try {
			post = await api.getPost(id);
		} catch (err: any) {
			error = err.message || 'Post introuvable';
		}
		loading = false;
	}
</script>

<div class="post-page container">
	{#if loading}
		<p class="loading-text">Chargement...</p>
	{:else if error}
		<p class="error-text">{error}</p>
	{:else if post}
		<div class="post-wrapper">
			<PostCard {post} />
		</div>
	{/if}
</div>

<style>
	.post-page {
		padding-top: 24px;
		padding-bottom: 24px;
	}

	.post-wrapper {
		max-width: 470px;
		margin: 0 auto;
	}

	.loading-text, .error-text {
		text-align: center;
		padding: 60px 20px;
		color: var(--text-secondary);
	}

	.error-text {
		color: var(--danger);
	}
</style>
