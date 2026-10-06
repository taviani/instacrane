import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, api, message } from '../../api';
import { dropPost, photoKey } from '../../cache';
import { PhotoPager } from '../../images';
import { useSession } from '../../session';
import { cursor, placeText, runes } from '../../text';
import type { Comment, Post } from '../../types';
import { Button, ConfirmButton, ErrorText, Field, Muted, colors } from '../../ui';

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { me, reloadBell } = useSession();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const found = await api<Post>(`/api/posts/${id}`);
      setPost(found);
      setComments(found.comments ?? []);
      setMissing(false);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        await dropPost(id);
        setMissing(true);
        setPost(null);
        return;
      }
      setError(message(cause));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function like() {
    if (!post || post.liked) return;
    await toggleLike(true);
  }

  async function toggleLike(forceLike = false) {
    if (!post || !id) return;
    setError(null);
    try {
      if (post.liked && !forceLike) {
        await api(`/api/posts/${id}/like`, { method: 'DELETE' });
        setPost({ ...post, liked: false, likes_count: Math.max(0, post.likes_count - 1) });
      } else if (!post.liked) {
        const result = await api<{ liked: boolean; likes_count: number }>(`/api/posts/${id}/like`, { method: 'POST' });
        setPost({ ...post, liked: result.liked, likes_count: result.likes_count });
        await reloadBell();
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        await dropPost(id);
        setMissing(true);
        return;
      }
      setError(message(cause));
    }
  }

  async function sendComment() {
    const text = body.trim();
    if (!id || !text || runes(text) > 1000) {
      setError('commentaire invalide');
      return;
    }
    setError(null);
    try {
      const created = await api<Comment>(`/api/posts/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      });
      setComments((current) => [...current, created]);
      setPost((current) => (current ? { ...current, comments_count: current.comments_count + 1 } : current));
      setBody('');
      await reloadBell();
    } catch (cause) {
      setError(message(cause));
    }
  }

  async function removeComment(commentId: string) {
    if (!id) return;
    setError(null);
    try {
      await api(`/api/posts/${id}/comments/${commentId}`, { method: 'DELETE' });
      setComments((current) => current.filter((comment) => comment.id !== commentId));
      setPost((current) => (current ? { ...current, comments_count: Math.max(0, current.comments_count - 1) } : current));
    } catch (cause) {
      setError(message(cause));
    }
  }

  async function moreComments() {
    if (!id) return;
    const last = comments.at(-1);
    if (!last) return;
    const query = new URLSearchParams({ limit: '30', after: cursor(last.created_at, last.id) });
    const page = await api<{ comments: Comment[] }>(`/api/posts/${id}/comments?${query}`);
    setComments((current) => [...current, ...(page.comments ?? [])]);
  }

  async function removePost() {
    if (!id) return;
    await api(`/api/posts/${id}`, { method: 'DELETE' });
    await dropPost(id);
    router.back();
  }

  async function report() {
    if (!id) return;
    await api(`/api/posts/${id}/report`, { method: 'POST' });
    setError('Signalement envoyé.');
  }

  if (missing) {
    return (
      <View style={{ padding: 16 }}>
        <Muted>Publication introuvable.</Muted>
      </View>
    );
  }
  if (!post) {
    return (
      <View style={{ padding: 16 }}>
        <ErrorText>{error}</ErrorText>
      </View>
    );
  }

  const mine = me?.username === post.author.username;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 24, gap: 12 }}>
      <PhotoPager
        photos={post.photos.map((photo) => ({
          key: photoKey(post.id, photo.position),
          url: photo.url,
          renew: () => renew(post.id, photo.position),
        }))}
        onLike={() => void like()}
      />
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        <Pressable onPress={() => router.push(`/user/${post.author.username}`)}>
          <Text style={{ fontWeight: '700' }}>{post.author.username}</Text>
        </Pressable>
        {post.latitude != null && post.longitude != null ? <Muted>{placeText(post.latitude, post.longitude)}</Muted> : null}
        <Button label={post.liked ? 'Retirer le j’aime' : 'Aimer'} onPress={() => void toggleLike()} />
        <Muted>
          {post.likes_count} j’aime · {post.comments_count} commentaire{post.comments_count === 1 ? '' : 's'}
        </Muted>
        {post.caption ? (
          <Text>
            <Text style={{ fontWeight: '700' }}>{post.author.username} </Text>
            {post.caption}
          </Text>
        ) : null}
        {comments.map((comment) => (
          <View key={comment.id} style={{ gap: 4 }}>
            <Text>
              <Text style={{ fontWeight: '700' }}>{comment.username} </Text>
              {comment.body}
            </Text>
            {me?.username === comment.username || mine ? (
              <Pressable onPress={() => void removeComment(comment.id)}>
                <Text style={{ color: '#9b1c1c' }}>Effacer</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {comments.length < post.comments_count ? <Button label="Commentaires suivants" onPress={() => void moreComments()} /> : null}
        <Field value={body} onChangeText={setBody} placeholder="Commentaire" />
        <Button label="Envoyer" onPress={() => void sendComment()} />
        <ErrorText>{error === 'Signalement envoyé.' ? null : error}</ErrorText>
        {error === 'Signalement envoyé.' ? <Muted>Signalement envoyé.</Muted> : null}
        {mine ? <ConfirmButton label="Effacer la publication" confirmLabel="Confirmer l’effacement" danger onConfirm={removePost} /> : (
          <ConfirmButton label="Signaler la publication" confirmLabel="Confirmer le signalement" onConfirm={report} />
        )}
      </View>
    </ScrollView>
  );
}

async function renew(id: string, position: number): Promise<string | null> {
  try {
    const post = await api<Post>(`/api/posts/${id}`);
    return post.photos.find((photo) => photo.position === position)?.url ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) await dropPost(id);
    return null;
  }
}
