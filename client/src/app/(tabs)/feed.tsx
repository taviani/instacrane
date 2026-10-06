import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, api, message } from '../../api';
import { dropPost, photoKey } from '../../cache';
import { CachedImage } from '../../images';
import { cursor, placeText } from '../../text';
import type { Post } from '../../types';
import { ErrorText, Muted, StackMark, Button, colors } from '../../ui';

export default function FeedScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursorValue, setCursorValue] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (before: string | null, replace: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ limit: '12' });
      if (before) query.set('before', before);
      const page = await api<{ posts: Post[] }>(`/api/posts/feed?${query}`);
      const items = page.posts ?? [];
      setPosts((current) => (replace ? items : [...current, ...items]));
      const last = items.at(-1);
      setCursorValue(last ? cursor(last.created_at, last.id) : before);
      setDone(items.length < 12);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null, true);
  }, [load]);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      data={posts}
      keyExtractor={(item) => item.id}
      refreshing={loading && posts.length === 0}
      onRefresh={() => void load(null, true)}
      onEndReached={() => {
        if (!done && !loading && cursorValue) void load(cursorValue, false);
      }}
      ListHeaderComponent={
        error ? (
          <View style={{ padding: 16 }}>
            <ErrorText>{error}</ErrorText>
          </View>
        ) : null
      }
      ListEmptyComponent={
        loading ? <ActivityIndicator /> : <View style={{ padding: 16 }}><Muted>Vos publications apparaîtront ici.</Muted></View>
      }
      ListFooterComponent={
        !done && cursorValue ? (
          <View style={{ padding: 16 }}>
            <Button label="Plus anciennes" onPress={() => void load(cursorValue, false)} />
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/post/${item.id}`)} style={{ paddingBottom: 20 }}>
          <View>
            <CachedImage
              name={photoKey(item.id, item.photos[0]?.position ?? 1)}
              url={item.photos[0]?.url}
              renew={() => renewPhoto(item.id, item.photos[0]?.position ?? 1)}
              style={{ width: '100%', aspectRatio: 4 / 5 }}
            />
            {item.photos.length > 1 ? <StackMark /> : null}
          </View>
          <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 4 }}>
            <Text style={{ fontWeight: '700' }}>{item.author.username}</Text>
            {item.caption ? <Text>{item.caption}</Text> : null}
            {item.latitude != null && item.longitude != null ? (
              <Muted>{placeText(item.latitude, item.longitude)}</Muted>
            ) : null}
            <Muted>
              {item.likes_count} j’aime · {item.comments_count} commentaire{item.comments_count === 1 ? '' : 's'}
            </Muted>
          </View>
        </Pressable>
      )}
    />
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
