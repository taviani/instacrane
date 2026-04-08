<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';
	import { getAuth } from '$lib/stores/auth.svelte';

	const auth = getAuth();
	let profile = $state<any>(null);
	let posts = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');

	$effect(() => {
		if (!auth.loading && !auth.isLoggedIn) {
			goto('/auth');
			return;
		}
		const username = $page.params.username;
		if (username && auth.isLoggedIn) loadProfile(username);
	});

	async function loadProfile(username: string) {
		loading = true;
		error = '';
		try {
			profile = await api.getProfile(username);
			posts = await api.getExplore(1); // TODO: get user posts endpoint
		} catch (err: any) {
			error = err.message || 'Profil introuvable';
		}
		loading = false;
	}

	async function toggleFollow() {
		if (!profile) return;
		if (profile.is_following) {
			await api.unfollow(profile.id);
			profile.is_following = false;
			profile.followers_count--;
		} else {
			await api.follow(profile.id);
			profile.is_following = true;
			profile.followers_count++;
		}
	}

	function handleLogout() {
		auth.logout();
		goto('/auth');
	}

	let fileInput: HTMLInputElement;

	async function handleAvatarChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const updated = await api.uploadAvatar(file);
		profile.avatar_url = updated.avatar_url;
	}
</script>

<div class="profile-page container">
	{#if loading}
		<p class="loading-text">Chargement...</p>
	{:else if error}
		<p class="error-text">{error}</p>
	{:else if profile}
		<header class="profile-header">
			<div class="profile-avatar-wrapper">
				{#if profile.avatar_url}
					<img src={profile.avatar_url} alt={profile.username} class="avatar profile-avatar" width="150" height="150" />
				{:else}
					<div class="avatar profile-avatar profile-avatar-empty">
						<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5">
							<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
							<circle cx="12" cy="7" r="4"/>
						</svg>
					</div>
				{/if}
				{#if auth.user?.id === profile.id}
					<input type="file" accept="image/*" bind:this={fileInput} onchange={handleAvatarChange} hidden />
					<button class="change-avatar-btn" onclick={() => fileInput.click()}>Changer</button>
				{/if}
			</div>

			<div class="profile-info">
				<div class="profile-top">
					<h1 class="profile-username">{profile.username}</h1>
					{#if auth.user?.id === profile.id}
						<a href="/profile/{profile.username}" class="btn btn-outline">Modifier le profil</a>
						<button class="btn btn-outline" onclick={handleLogout}>Déconnexion</button>
					{:else}
						<button
							class="btn {profile.is_following ? 'btn-outline' : 'btn-primary'}"
							onclick={toggleFollow}
						>
							{profile.is_following ? 'Abonné(e)' : "S'abonner"}
						</button>
					{/if}
				</div>

				<div class="profile-stats">
					<span><strong>{profile.posts_count}</strong> publications</span>
					<span><strong>{profile.followers_count}</strong> abonnés</span>
					<span><strong>{profile.following_count}</strong> abonnements</span>
				</div>

				{#if profile.display_name}
					<p class="profile-display-name">{profile.display_name}</p>
				{/if}
				{#if profile.bio}
					<p class="profile-bio">{profile.bio}</p>
				{/if}
			</div>
		</header>

		<hr class="profile-divider" />

		<div class="profile-grid">
			{#each posts as post (post.id)}
				<a href="/post/{post.id}" class="grid-item">
					<img src={post.image_url} alt={post.caption || 'Photo'} loading="lazy" />
				</a>
			{/each}
		</div>

		{#if posts.length === 0}
			<p class="no-posts">Aucune publication pour l'instant.</p>
		{/if}
	{/if}
</div>

<style>
	.profile-page {
		padding-top: 32px;
		padding-bottom: 32px;
	}

	.profile-header {
		display: flex;
		gap: 40px;
		margin-bottom: 24px;
		align-items: flex-start;
	}

	.profile-avatar-wrapper {
		position: relative;
		flex-shrink: 0;
	}

	.profile-avatar {
		width: 150px;
		height: 150px;
	}

	.profile-avatar-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg);
		width: 150px;
		height: 150px;
	}

	.change-avatar-btn {
		position: absolute;
		bottom: 4px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(0, 0, 0, 0.6);
		color: white;
		font-size: 11px;
		padding: 4px 10px;
		border-radius: 4px;
	}

	.profile-info {
		flex: 1;
	}

	.profile-top {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 16px;
		flex-wrap: wrap;
	}

	.profile-username {
		font-size: 20px;
		font-weight: 400;
	}

	.profile-stats {
		display: flex;
		gap: 32px;
		margin-bottom: 12px;
		font-size: 16px;
	}

	.profile-display-name {
		font-weight: 600;
		font-size: 14px;
	}

	.profile-bio {
		font-size: 14px;
		margin-top: 4px;
	}

	.profile-divider {
		border: none;
		border-top: 1px solid var(--border);
		margin-bottom: 24px;
	}

	.profile-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 4px;
	}

	.grid-item {
		aspect-ratio: 1;
		overflow: hidden;
	}

	.grid-item img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.no-posts {
		text-align: center;
		color: var(--text-secondary);
		padding: 60px 20px;
		font-size: 14px;
	}

	.loading-text, .error-text {
		text-align: center;
		padding: 60px 20px;
		color: var(--text-secondary);
	}

	.error-text {
		color: var(--danger);
	}

	@media (max-width: 600px) {
		.profile-header {
			flex-direction: column;
			align-items: center;
			text-align: center;
			gap: 16px;
		}

		.profile-top {
			justify-content: center;
		}

		.profile-stats {
			justify-content: center;
		}

		.profile-avatar {
			width: 80px;
			height: 80px;
		}

		.profile-avatar-empty {
			width: 80px;
			height: 80px;
		}
	}
</style>
