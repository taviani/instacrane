<script lang="ts">
	import { goto } from '$app/navigation';
	import { getAuth } from '$lib/stores/auth.svelte';

	const auth = getAuth();

	let isLogin = $state(true);
	let login = $state('');
	let email = $state('');
	let username = $state('');
	let password = $state('');
	let displayName = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			if (isLogin) {
				await auth.login(login, password);
			} else {
				await auth.register(username, email, password, displayName || undefined);
			}
			goto('/feed');
		} catch (err: any) {
			error = err.message || 'Une erreur est survenue';
		} finally {
			loading = false;
		}
	}
</script>

<div class="auth-page">
	<div class="auth-card">
		<h1 class="auth-logo">Instacrane</h1>

		{#if error}
			<p class="auth-error">{error}</p>
		{/if}

		<form onsubmit={handleSubmit}>
			{#if isLogin}
				<input type="text" placeholder="Nom d'utilisateur ou email" bind:value={login} required />
			{:else}
				<input type="email" placeholder="Email" bind:value={email} required />
				<input type="text" placeholder="Nom d'utilisateur" bind:value={username} required minlength="3" maxlength="30" pattern="[a-zA-Z0-9_.]+" />
				<input type="text" placeholder="Nom affiché (optionnel)" bind:value={displayName} maxlength="50" />
			{/if}
			<input type="password" placeholder="Mot de passe" bind:value={password} required minlength="8" />
			<button type="submit" class="btn btn-primary auth-submit" disabled={loading}>
				{loading ? 'Chargement...' : isLogin ? 'Se connecter' : "S'inscrire"}
			</button>
		</form>
	</div>

	<div class="auth-switch">
		{#if isLogin}
			<p>Pas de compte ? <button onclick={() => { isLogin = false; error = ''; }}>Inscrivez-vous</button></p>
		{:else}
			<p>Déjà un compte ? <button onclick={() => { isLogin = true; error = ''; }}>Connectez-vous</button></p>
		{/if}
	</div>

	<footer class="auth-footer">
		<p>Open source · Hébergé en France · Respectueux de votre vie privée</p>
	</footer>
</div>

<style>
	.auth-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - var(--nav-height));
		padding: 20px;
	}

	.auth-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 40px;
		width: 100%;
		max-width: 350px;
		text-align: center;
	}

	.auth-logo {
		font-size: 36px;
		font-style: italic;
		font-weight: 700;
		margin-bottom: 24px;
		letter-spacing: -1px;
	}

	.auth-error {
		background: #fef2f2;
		color: var(--danger);
		padding: 10px;
		border-radius: 4px;
		font-size: 14px;
		margin-bottom: 12px;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	input {
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg);
		font-size: 14px;
		outline: none;
	}

	input:focus {
		border-color: var(--text-secondary);
	}

	.auth-submit {
		margin-top: 8px;
		width: 100%;
		padding: 10px;
	}

	.auth-switch {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 20px;
		margin-top: 12px;
		width: 100%;
		max-width: 350px;
		text-align: center;
		font-size: 14px;
	}

	.auth-switch button {
		background: none;
		color: var(--accent);
		font-weight: 600;
	}

	.auth-footer {
		margin-top: 24px;
		color: var(--text-secondary);
		font-size: 12px;
		text-align: center;
	}
</style>
