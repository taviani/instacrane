<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';
	import { getAuth } from '$lib/stores/auth.svelte';

	const auth = getAuth();
	let posts = $state<any[]>([]);
	let searchQuery = $state('');
	let searchResults = $state<any[]>([]);
	let showSearch = $state(false);
	let loading = $state(true);
	let page = $state(1);

	$effect(() => {
		if (!auth.loading && !auth.isLoggedIn) {
			goto('/auth');
			return;
		}
		if (auth.isLoggedIn) loadExplore();
	});

	async function loadExplore() {
		loading = true;
		const newPosts = await api.getExplore(page);
		posts = page === 1 ? newPosts : [...posts, ...newPosts];
		loading = false;
	}

	let searchTimeout: ReturnType<typeof setTimeout>;
	function handleSearch() {
		clearTimeout(searchTimeout);
		if (!searchQuery.trim()) {
			searchResults = [];
			showSearch = false;
			return;
		}
		showSearch = true;
		searchTimeout = setTimeout(async () => {
			searchResults = await api.searchUsers(searchQuery);
		}, 300);
	}
</script>

<div class="explore-page container">
	<div class="search-bar">
		<input
			type="text"
			placeholder="Rechercher un utilisateur..."
			bind:value={searchQuery}
			oninput={handleSearch}
		/>
	</div>

	{#if showSearch}
		<div class="search-results">
			{#each searchResults as user (user.id)}
				<a href="/profile/{user.username}" class="search-result">
					{#if user.avatar_url}
						<img src={user.avatar_url} alt="" class="avatar" width="44" height="44" />
					{:else}
						<div class="avatar avatar-placeholder" style="width:44px;height:44px;"></div>
					{/if}
					<div>
						<p class="result-username">{user.username}</p>
						{#if user.display_name}
							<p class="result-name">{user.display_name}</p>
						{/if}
					</div>
				</a>
			{:else}
				{#if searchQuery.trim()}
					<p class="no-results">Aucun résultat</p>
				{/if}
			{/each}
		</div>
	{:else}
		<div class="explore-grid">
			{#each posts as post (post.id)}
				<a href="/post/{post.id}" class="explore-item">
					<img src={post.image_url} alt={post.caption || 'Photo'} loading="lazy" />
					<div class="explore-overlay">
						<span>{post.likes_count} J'aime</span>
						<span>{post.comments_count} commentaires</span>
					</div>
				</a>
			{/each}
		</div>

		{#if loading}
			<p class="loading-text">Chargement...</p>
		{/if}
	{/if}
</div>

<style>
	.explore-page {
		padding-top: 24px;
		padding-bottom: 24px;
	}

	.search-bar {
		max-width: 470px;
		margin: 0 auto 24px;
	}

	.search-bar input {
		width: 100%;
		padding: 10px 16px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		outline: none;
		font-size: 14px;
	}

	.search-bar input:focus {
		border-color: var(--text-secondary);
	}

	.search-results {
		max-width: 470px;
		margin: 0 auto;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
	}

	.search-result {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border);
		transition: background 0.1s;
	}

	.search-result:last-child {
		border-bottom: none;
	}

	.search-result:hover {
		background: var(--bg);
	}

	.avatar-placeholder {
		background: var(--border);
		display: inline-block;
	}

	.result-username {
		font-weight: 600;
		font-size: 14px;
	}

	.result-name {
		color: var(--text-secondary);
		font-size: 14px;
	}

	.no-results {
		padding: 24px;
		text-align: center;
		color: var(--text-secondary);
		font-size: 14px;
	}

	.explore-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 4px;
	}

	.explore-item {
		position: relative;
		aspect-ratio: 1;
		overflow: hidden;
	}

	.explore-item img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.explore-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
		opacity: 0;
		transition: opacity 0.2s;
		color: white;
		font-weight: 600;
		font-size: 14px;
	}

	.explore-item:hover .explore-overlay {
		opacity: 1;
	}

	.loading-text {
		text-align: center;
		color: var(--text-secondary);
		padding: 40px;
	}
</style>
