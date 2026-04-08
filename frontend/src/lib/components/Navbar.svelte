<script lang="ts">
	import { getAuth } from '$lib/stores/auth.svelte';

	const auth = getAuth();
</script>

<nav class="navbar">
	<div class="navbar-inner container">
		<a href="/feed" class="logo">Instacrane</a>

		{#if auth.isLoggedIn}
			<div class="nav-actions">
				<a href="/feed" class="nav-icon" title="Accueil">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
						<polyline points="9 22 9 12 15 12 15 22"/>
					</svg>
				</a>
				<a href="/explore" class="nav-icon" title="Explorer">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="11" cy="11" r="8"/>
						<line x1="21" y1="21" x2="16.65" y2="16.65"/>
					</svg>
				</a>
				<a href="/upload" class="nav-icon" title="Publier">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
						<line x1="12" y1="8" x2="12" y2="16"/>
						<line x1="8" y1="12" x2="16" y2="12"/>
					</svg>
				</a>
				<a href="/profile/{auth.user?.username}" class="nav-icon" title="Profil">
					{#if auth.user?.avatar_url}
						<img src={auth.user.avatar_url} alt="avatar" class="avatar nav-avatar" width="24" height="24" />
					{:else}
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
							<circle cx="12" cy="7" r="4"/>
						</svg>
					{/if}
				</a>
			</div>
		{:else}
			<div class="nav-actions">
				<a href="/auth" class="btn btn-primary">Connexion</a>
			</div>
		{/if}
	</div>
</nav>

<style>
	.navbar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: var(--nav-height);
		background: var(--bg-card);
		border-bottom: 1px solid var(--border);
		z-index: 100;
	}

	.navbar-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 100%;
	}

	.logo {
		font-size: 22px;
		font-weight: 700;
		font-style: italic;
		letter-spacing: -0.5px;
	}

	.nav-actions {
		display: flex;
		align-items: center;
		gap: 20px;
	}

	.nav-icon {
		color: var(--text-primary);
		display: flex;
		align-items: center;
		transition: opacity 0.15s;
	}

	.nav-icon:hover {
		opacity: 0.6;
	}

	.nav-avatar {
		width: 24px;
		height: 24px;
		border: 1px solid var(--border);
	}
</style>
