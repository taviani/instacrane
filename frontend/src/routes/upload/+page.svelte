<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';
	import { getAuth } from '$lib/stores/auth.svelte';

	const auth = getAuth();

	let file = $state<File | null>(null);
	let preview = $state<string | null>(null);
	let caption = $state('');
	let uploading = $state(false);
	let error = $state('');

	$effect(() => {
		if (!auth.loading && !auth.isLoggedIn) goto('/auth');
	});

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const selected = input.files?.[0];
		if (!selected) return;

		if (!selected.type.startsWith('image/')) {
			error = 'Veuillez sélectionner une image';
			return;
		}

		file = selected;
		preview = URL.createObjectURL(selected);
		error = '';
	}

	function removeFile() {
		if (preview) URL.revokeObjectURL(preview);
		file = null;
		preview = null;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!file) return;

		uploading = true;
		error = '';
		try {
			await api.createPost(file, caption || undefined);
			goto('/feed');
		} catch (err: any) {
			error = err.message || 'Erreur lors de la publication';
		} finally {
			uploading = false;
		}
	}
</script>

<div class="upload-page container">
	<div class="upload-card">
		<h1>Nouvelle publication</h1>

		{#if error}
			<p class="upload-error">{error}</p>
		{/if}

		<form onsubmit={handleSubmit}>
			{#if !preview}
				<label class="upload-zone">
					<input type="file" accept="image/*" onchange={handleFileChange} hidden />
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5">
						<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
						<circle cx="8.5" cy="8.5" r="1.5"/>
						<polyline points="21 15 16 10 5 21"/>
					</svg>
					<p>Glissez ou cliquez pour ajouter une photo</p>
				</label>
			{:else}
				<div class="preview-container">
					<img src={preview} alt="Aperçu" class="preview-image" />
					<button type="button" class="remove-btn" onclick={removeFile}>Supprimer</button>
				</div>
			{/if}

			<textarea
				placeholder="Écrivez une légende..."
				bind:value={caption}
				maxlength="2200"
				rows="3"
			></textarea>

			<button type="submit" class="btn btn-primary upload-submit" disabled={!file || uploading}>
				{uploading ? 'Publication...' : 'Publier'}
			</button>
		</form>
	</div>
</div>

<style>
	.upload-page {
		display: flex;
		justify-content: center;
		padding-top: 40px;
		padding-bottom: 40px;
	}

	.upload-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 32px;
		width: 100%;
		max-width: 500px;
	}

	h1 {
		font-size: 20px;
		margin-bottom: 20px;
		text-align: center;
	}

	.upload-error {
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
		gap: 16px;
	}

	.upload-zone {
		border: 2px dashed var(--border);
		border-radius: 8px;
		padding: 48px 24px;
		text-align: center;
		cursor: pointer;
		color: var(--text-secondary);
		transition: border-color 0.15s;
	}

	.upload-zone:hover {
		border-color: var(--text-secondary);
	}

	.upload-zone p {
		margin-top: 12px;
		font-size: 14px;
	}

	.preview-container {
		position: relative;
	}

	.preview-image {
		width: 100%;
		border-radius: 8px;
		display: block;
	}

	.remove-btn {
		position: absolute;
		top: 8px;
		right: 8px;
		background: rgba(0, 0, 0, 0.6);
		color: white;
		padding: 6px 12px;
		border-radius: 4px;
		font-size: 12px;
	}

	textarea {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 12px;
		resize: vertical;
		outline: none;
		background: var(--bg);
	}

	textarea:focus {
		border-color: var(--text-secondary);
	}

	.upload-submit {
		width: 100%;
		padding: 12px;
	}
</style>
