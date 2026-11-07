import { useState } from 'react';
import { Platform, Pressable, Share, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { ApiError, api, message } from './api';
import { dropPost, photoKey } from './cache';
import { BubbleIcon, HeartIcon } from './icons';
import { PhotoPager } from './images';
import { publicationPath } from './permalink';
import { photoPlaceFor } from './publish-draft';
import { useSession } from './session';
import { ago, placeText, runes } from './text';
import type { Post } from './types';
import { Button, ChoiceDialog, ConfirmDialog, ErrorText, Field, Muted, colors } from './ui';

export function PostCard({
  post,
  onChange,
  onGone,
  here,
}: {
  post: Post;
  onChange: (post: Post) => void;
  onGone: () => void;
  here?: boolean;
}) {
  const router = useRouter();
  const { me, reloadBell } = useSession();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [ask, setAsk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [caption, setCaption] = useState(post.caption ?? '');
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
    if (await save({ caption: caption.trim() })) setEditing(false);
  }

  async function saveHere() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      setError('Position indisponible.');
      return;
    }
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    if (await save({ latitude: current.coords.latitude, longitude: current.coords.longitude })) setEditing(false);
  }

  async function savePhotoPlace() {
    const place = photoPlaceFor(post.id);
    if (!place) {
      setError('Cette photo n’a pas de position.');
      return;
    }
    if (await save(place)) setEditing(false);
  }

  async function clearPlace() {
    if (await save({ latitude: null, longitude: null })) setEditing(false);
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

  function openMenu() {
    setNotice(null);
    setMenu(true);
  }

  async function copyLink() {
    const url = linkFor(post.id);
    setMenu(false);
    if (!url) {
      setError('Lien indisponible.');
      return;
    }
    try {
      await Clipboard.setStringAsync(url);
      setNotice('Lien copié.');
    } catch {
      setError('Copie indisponible.');
    }
  }

  async function shareLink() {
    const url = linkFor(post.id);
    setMenu(false);
    if (!url) {
      setError('Lien indisponible.');
      return;
    }
    try {
      await Share.share(Platform.OS === 'ios' ? { url } : { message: url });
    } catch {
      setError('Partage indisponible.');
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
        <Pressable accessibilityRole="button" accessibilityLabel="Plus" onPress={openMenu} hitSlop={8}>
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
        {post.preview_username && post.preview_body ? (
          <Text>
            <Text style={{ fontWeight: '700' }}>{post.preview_username} </Text>
            {post.preview_body}
          </Text>
        ) : null}
        {post.latitude != null && post.longitude != null ? <Muted>{placeText(post.latitude, post.longitude)}</Muted> : null}
        <Muted>{ago(post.created_at)}</Muted>
        {notice ? <Muted>{notice}</Muted> : null}
        <ErrorText>{error}</ErrorText>
      </View>
      <ChoiceDialog
        visible={menu}
        choices={[
          ...(!here
            ? [
                {
                  label: 'Accéder à cette publication',
                  onPress: () => {
                    setMenu(false);
                    router.push(`/publication/${post.id}`);
                  },
                },
              ]
            : []),
          { label: 'Copier le lien', onPress: () => void copyLink() },
          { label: 'Partager sur…', onPress: () => void shareLink() },
          ...(mine
            ? [
                {
                  label: 'Modifier',
                  onPress: () => {
                    setCaption(post.caption ?? '');
                    setError(null);
                    setMenu(false);
                    setEditing(true);
                  },
                },
                {
                  label: 'Supprimer',
                  danger: true,
                  onPress: () => {
                    setMenu(false);
                    setAsk(true);
                  },
                },
              ]
            : [
                {
                  label: 'Signaler',
                  onPress: () => {
                    setMenu(false);
                    setAsk(true);
                  },
                },
              ]),
        ]}
        onCancel={() => setMenu(false)}
      />
      <ChoiceDialog
        visible={editing}
        onCancel={() => setEditing(false)}
        choices={[
          { label: 'Enregistrer la légende', onPress: () => void saveCaption() },
          { label: 'Position du moment', onPress: () => void saveHere() },
          { label: 'Position de la photo', onPress: () => void savePhotoPlace() },
          ...(post.latitude != null ? [{ label: 'Retirer la position', onPress: () => void clearPlace(), danger: true }] : []),
        ]}
      >
        <Field value={caption} onChangeText={setCaption} placeholder="Légende" multiline autoCapitalize="sentences" />
        <Muted>Une seule source. L’autre est oubliée.</Muted>
        <ErrorText>{error}</ErrorText>
      </ChoiceDialog>
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

function linkFor(id: string): string | null {
  const path = publicationPath(id);
  if (!path) return null;
  return Linking.createURL(path) || null;
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
