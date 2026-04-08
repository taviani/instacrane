<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';
	import PostCard from '$lib/components/PostCard.svelte';
	import { getAuth } from '$lib/stores/auth.svelte';

	const auth = getAuth();
	let posts = $state<any[]>([]);
	let page = $state(1);
	let loading = $state(true);
	let hasMore = $state(true);

	$effect(() => {
		if (!auth.loading && !auth.isLoggedIn) {
			goto('/auth');
			return;
		}
		if (auth.isLoggedIn) loadPosts();
	});

	async function loadPosts() {
		loading = true;
		try {
			const newPosts = await api.getFeed(page);
			posts = page === 1 ? newPosts : [...posts, ...newPosts];
			hasMore = newPosts.length === 20;
		} catch {
			// ignore
		}
		loading = false;
	}

	function loadMore() {
		page++;
		loadPosts();
	}
</script>

<div class="feed container">
	{#if posts.length === 0 && !loading}
		<div class="empty-feed">
			<h2>Bienvenue sur Instacrane</h2>
			<p>Suivez des personnes ou publiez votre première photo pour voir du contenu ici.</p>
			<div class="empty-actions">
				<a href="/upload" class="btn btn-primary">Publier une photo</a>
				<a href="/explore" class="btn btn-outline">Explorer</a>
			</div>
		</div>
	{:else}
		<div class="feed-posts">
			{#each posts as post (post.id)}
				<PostCard {post} />
			{/each}
		</div>

		{#if hasMore && !loading}
			<div class="load-more">
				<button class="btn btn-outline" onclick={loadMore}>Charger plus</button>
			</div>
		{/if}
	{/if}

	{#if loading}
		<p class="loading-text">Chargement...</p>
	{/if}
</div>

<style>
	.feed {
		padding-top: 24px;
		padding-bottom: 24px;
	}

	.feed-posts {
		max-width: 470px;
		margin: 0 auto;
	}

	.empty-feed {
		text-align: center;
		padding: 60px 20px;
		max-width: 400px;
		margin: 0 auto;
	}

	.empty-feed h2 {
		font-size: 20px;
		margin-bottom: 12px;
	}

	.empty-feed p {
		color: var(--text-secondary);
		font-size: 14px;
		margin-bottom: 24px;
	}

	.empty-actions {
		display: flex;
		gap: 12px;
		justify-content: center;
	}

	.load-more {
		text-align: center;
		padding: 20px;
	}

	.loading-text {
		text-align: center;
		color: var(--text-secondary);
		padding: 40px;
	}
</style>
