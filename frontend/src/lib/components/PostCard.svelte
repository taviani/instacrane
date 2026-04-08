<script lang="ts">
	import { api } from '$lib/api/client';

	interface Props {
		post: any;
	}

	let { post }: Props = $props();

	let liked = $state(post.is_liked);
	let likesCount = $state(post.likes_count);
	let commentText = $state('');
	let comments = $state<any[]>([]);
	let showComments = $state(false);

	async function toggleLike() {
		if (liked) {
			await api.unlikePost(post.id);
			likesCount--;
		} else {
			await api.likePost(post.id);
			likesCount++;
		}
		liked = !liked;
	}

	async function loadComments() {
		showComments = !showComments;
		if (showComments && comments.length === 0) {
			comments = await api.getComments(post.id);
		}
	}

	async function submitComment(e: Event) {
		e.preventDefault();
		if (!commentText.trim()) return;
		const comment = await api.addComment(post.id, commentText.trim());
		comments = [...comments, comment];
		commentText = '';
		post.comments_count++;
	}

	function timeAgo(dateStr: string): string {
		const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
		if (seconds < 60) return 'maintenant';
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes} min`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours} h`;
		const days = Math.floor(hours / 24);
		if (days < 7) return `${days} j`;
		const weeks = Math.floor(days / 7);
		return `${weeks} sem`;
	}
</script>

<article class="post-card">
	<header class="post-header">
		<a href="/profile/{post.author.username}" class="post-author">
			{#if post.author.avatar_url}
				<img src={post.author.avatar_url} alt="" class="avatar" width="32" height="32" />
			{:else}
				<div class="avatar avatar-placeholder" style="width:32px;height:32px;"></div>
			{/if}
			<span class="post-username">{post.author.username}</span>
		</a>
	</header>

	<img src={post.image_url} alt={post.caption || 'Photo'} class="post-image" loading="lazy" />

	<div class="post-actions">
		<button class="action-btn" onclick={toggleLike} aria-label={liked ? 'Retirer le like' : 'Liker'}>
			<svg width="24" height="24" viewBox="0 0 24 24" fill={liked ? 'var(--danger)' : 'none'} stroke={liked ? 'var(--danger)' : 'currentColor'} stroke-width="2">
				<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
			</svg>
		</button>
		<button class="action-btn" onclick={loadComments} aria-label="Commentaires">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
			</svg>
		</button>
	</div>

	<div class="post-info">
		<p class="post-likes">{likesCount} J'aime</p>
		{#if post.caption}
			<p class="post-caption">
				<a href="/profile/{post.author.username}" class="post-username">{post.author.username}</a>
				{post.caption}
			</p>
		{/if}
		{#if post.comments_count > 0 && !showComments}
			<button class="show-comments" onclick={loadComments}>
				Voir les {post.comments_count} commentaire{post.comments_count > 1 ? 's' : ''}
			</button>
		{/if}
		<time class="post-time">{timeAgo(post.created_at)}</time>
	</div>

	{#if showComments}
		<div class="comments-section">
			{#each comments as comment}
				<p class="comment">
					<a href="/profile/{comment.author.username}" class="post-username">{comment.author.username}</a>
					{comment.content}
				</p>
			{/each}
		</div>
	{/if}

	<form class="comment-form" onsubmit={submitComment}>
		<input
			type="text"
			placeholder="Ajouter un commentaire..."
			bind:value={commentText}
			maxlength="500"
		/>
		<button type="submit" class="comment-submit" disabled={!commentText.trim()}>Publier</button>
	</form>
</article>

<style>
	.post-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		margin-bottom: 24px;
		overflow: hidden;
	}

	.post-header {
		display: flex;
		align-items: center;
		padding: 14px 16px;
	}

	.post-author {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.post-username {
		font-weight: 600;
		font-size: 14px;
	}

	.avatar-placeholder {
		background: var(--border);
		display: inline-block;
	}

	.post-image {
		width: 100%;
		display: block;
		max-height: 600px;
		object-fit: cover;
	}

	.post-actions {
		display: flex;
		gap: 12px;
		padding: 8px 16px 0;
	}

	.action-btn {
		background: none;
		padding: 4px;
		display: flex;
		align-items: center;
		color: var(--text-primary);
	}

	.action-btn:hover {
		opacity: 0.6;
	}

	.post-info {
		padding: 0 16px 8px;
	}

	.post-likes {
		font-weight: 600;
		font-size: 14px;
		margin: 4px 0;
	}

	.post-caption {
		font-size: 14px;
		margin: 4px 0;
	}

	.show-comments {
		background: none;
		color: var(--text-secondary);
		font-size: 14px;
		padding: 4px 0;
	}

	.post-time {
		display: block;
		color: var(--text-secondary);
		font-size: 10px;
		text-transform: uppercase;
		margin-top: 4px;
	}

	.comments-section {
		padding: 0 16px 8px;
		max-height: 200px;
		overflow-y: auto;
	}

	.comment {
		font-size: 14px;
		margin: 4px 0;
	}

	.comment-form {
		display: flex;
		align-items: center;
		border-top: 1px solid var(--border);
		padding: 0 16px;
	}

	.comment-form input {
		flex: 1;
		border: none;
		outline: none;
		padding: 14px 0;
		font-size: 14px;
		background: transparent;
	}

	.comment-submit {
		background: none;
		color: var(--accent);
		font-weight: 600;
		font-size: 14px;
		padding: 0;
	}

	.comment-submit:disabled {
		opacity: 0.3;
	}
</style>
