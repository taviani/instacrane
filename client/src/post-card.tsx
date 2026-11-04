import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { ApiError, api, message } from './api';
import { dropPost, photoKey } from './cache';
import { BubbleIcon, HeartIcon } from './icons';
import { PhotoPager } from './images';
import { photoPlaceFor } from './publish-draft';
import { useSession } from './session';
import { ago, placeText, runes } from './text';
import type { Post } from './types';
import { Button, ConfirmDialog, ErrorText, Field, Muted, colors } from './ui';

export function PostCard({
  post,
  onChange,
  onGone,
}: {
  post: Post;
  onChange: (post: Post) => void;
  onGone: () => void;
}) {
  const router = useRouter();
  const { me, reloadBell } = useSession();
  const [ask, setAsk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captionOpen, setCaptionOpen] = useState(false);
  const [caption, setCaption] = useState(post.caption ?? '');
  const [placeOpen, setPlaceOpen] = useState(false);
  const mine = me?.username === post.author.username;

  async function likeOnly() {
    if (post.liked) return;
    await toggle();
  }

  async function toggle() {
    setError(null);
    try {
      if (post.liked) {
        await api(`/api/posts/${post.id}/like`, { method: 'DELETE' });
        onChange({ ...post, liked: false, likes_count: Math.max(0, post.likes_count - 1) });
      } else {
        const result = await api<{ liked: boolean; likes_count: number }>(`/api/posts/${post.id}/like`, { method: 'POST' });
        onChange({ ...post, liked: result.liked, likes_count: result.likes_count });
        await reloadBell();
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        await dropPost(post.id);
        onGone();
        return;
      }
      setError(message(cause));
    }
  }

  async function saveCaption() {
    if (runes(caption.trim()) > 2200) {
      setError('légende invalide');
      return;
    }
    if (await save({ caption: caption.trim() })) setCaptionOpen(false);
  }

  async function saveHere() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      setError('Position indisponible.');
      return;
    }
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    if (await save({ latitude: current.coords.latitude, longitude: current.coords.longitude })) setPlaceOpen(false);
  }

  async function savePhotoPlace() {
    const place = photoPlaceFor(post.id);
    if (!place) {
      setError('Cette photo n’a pas de position.');
      return;
    }
    if (await save(place)) setPlaceOpen(false);
  }

  async function clearPlace() {
    if (await save({ latitude: null, longitude: null })) setPlaceOpen(false);
  }

  async function save(body: { caption?: string; latitude?: number | null; longitude?: number | null }): Promise<boolean> {
    setError(null);
    try {
      const next = await api<Post>(`/api/posts/${post.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      onChange(next);
      return true;
    } catch (cause) {
      setError(message(cause));
      return false;
    }
  }

  async function act() {
    setError(null);
    try {
      if (mine) {
        await api(`/api/posts/${post.id}`, { method: 'DELETE' });
        await dropPost(post.id);
        onGone();
        return;
      }
      await api(`/api/posts/${post.id}/report`, { method: 'POST' });
    } catch (cause) {
      setError(message(cause));
    }
  }

  return (
    <View style={{ paddingBottom: 24, gap: 8 }}>
      <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="link" onPress={() => router.push(`/user/${post.author.username}`)}>
          <Text style={{ fontWeight: '700' }}>{post.author.username}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Plus" onPress={() => setAsk(true)} hitSlop={8}>
          <Text style={{ fontSize: 22, letterSpacing: 1 }}>···</Text>
        </Pressable>
      </View>
      <PhotoPager
        photos={post.photos.map((photo) => ({
          key: photoKey(post.id, photo.position),
          url: photo.url,
          renew: () => renewPhoto(post.id, photo.position),
        }))}
        onLike={() => void likeOnly()}
      />
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Personnes qui ont aimé" onPress={() => router.push(`/likes/${post.id}`)}>
              <Text style={{ fontWeight: '700' }}>{post.likes_count}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={post.liked ? 'Retirer le j’aime' : 'Aimer'} onPress={() => void toggle()}>
              <HeartIcon color={post.liked ? colors.mark : colors.text} filled={post.liked} size={24} />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Commentaires"
            onPress={() => router.push(`/post/${post.id}`)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <BubbleIcon size={24} />
            <Text style={{ fontWeight: '700' }}>{post.comments_count}</Text>
          </Pressable>
        </View>
        {post.caption ? (
          <Text>
            <Text style={{ fontWeight: '700' }}>{post.author.username} </Text>
            {post.caption}
          </Text>
        ) : null}
        {mine && !captionOpen ? (
          <Pressable onPress={() => { setCaption(post.caption ?? ''); setCaptionOpen(true); }}>
            <Muted>{post.caption ? 'Modifier la légende' : 'Ajouter une légende'}</Muted>
          </Pressable>
        ) : null}
        {mine && captionOpen ? (
          <View style={{ gap: 8 }}>
            <Field value={caption} onChangeText={setCaption} placeholder="Légende" multiline />
            <Button label="Enregistrer la légende" onPress={() => void saveCaption()} />
          </View>
        ) : null}
        {mine && !placeOpen ? (
          <Pressable onPress={() => setPlaceOpen(true)}>
            <Muted>{post.latitude != null ? 'Modifier la position' : 'Ajouter une position'}</Muted>
          </Pressable>
        ) : null}
        {mine && placeOpen ? (
          <View style={{ gap: 8 }}>
            <Muted>Une seule source. L’autre est oubliée.</Muted>
            <Button label="Position du moment" onPress={() => void saveHere()} />
            <Button label="Position de la photo" onPress={() => void savePhotoPlace()} />
            {post.latitude != null ? <Button label="Retirer la position" onPress={() => void clearPlace()} /> : null}
          </View>
        ) : null}
        {post.preview_username && post.preview_body ? (
          <Text>
            <Text style={{ fontWeight: '700' }}>{post.preview_username} </Text>
            {post.preview_body}
          </Text>
        ) : null}
        {post.latitude != null && post.longitude != null ? <Muted>{placeText(post.latitude, post.longitude)}</Muted> : null}
        <Muted>{ago(post.created_at)}</Muted>
        <ErrorText>{error}</ErrorText>
      </View>
      <ConfirmDialog
        visible={ask}
        message={mine ? 'Effacer la publication ?' : 'Signaler la publication ?'}
        confirmLabel={mine ? 'Confirmer l’effacement' : 'Confirmer le signalement'}
        danger={mine}
        onCancel={() => setAsk(false)}
        onConfirm={() => {
          setAsk(false);
          void act();
        }}
      />
    </View>
  );
}

async function renewPhoto(id: string, position: number): Promise<string | null> {
  try {
    const post = await api<Post>(`/api/posts/${id}`);
    return post.photos.find((photo) => photo.position === position)?.url ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) await dropPost(id);
    return null;
  }
}
