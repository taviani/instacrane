import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, api, message } from './api';
import { dropPost, thumbKey } from './cache';
import { CachedImage } from './images';
import { cursor } from './text';
import type { GridPost, Post } from './types';
import { ErrorText, Muted, StackMark, Button } from './ui';

export function PhotoGrid({ username }: { username: string }) {
  const router = useRouter();
  const [posts, setPosts] = useState<GridPost[]>([]);
  const [cursorValue, setCursorValue] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (before: string | null, replace: boolean) => {
    try {
      const query = new URLSearchParams({ limit: '12' });
      if (before) query.set('before', before);
      const page = await api<{ posts: GridPost[] }>(`/api/users/${encodeURIComponent(username)}/posts?${query}`);
      const items = page.posts ?? [];
      setPosts((current) => (replace ? items : [...current, ...items]));
      const last = items.at(-1);
      setCursorValue(last ? cursor(last.created_at, last.id) : before);
      setDone(items.length < 12);
      setError(null);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setLoaded(true);
    }
  }, [username]);

  useEffect(() => {
    void load(null, true);
  }, [load]);

  if (!loaded) return null;
  if (posts.length === 0 && !error) return <Muted>Aucune photo visible.</Muted>;

  return (
    <View style={{ gap: 8 }}>
      <ErrorText>{error}</ErrorText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {posts.map((item) => (
          <Pressable key={item.id} onPress={() => router.push(`/post/${item.id}`)} style={{ width: '33.33%', aspectRatio: 1, padding: 1 }}>
            <CachedImage
              name={thumbKey(item.id)}
              url={item.thumbnail_url}
              renew={() => renewThumb(item.id)}
              style={{ width: '100%', height: '100%' }}
            />
            {item.photo_count > 1 ? <StackMark /> : null}
          </Pressable>
        ))}
      </View>
      {!done && cursorValue ? <Button label="Plus anciennes" onPress={() => void load(cursorValue, false)} /> : null}
    </View>
  );
}

async function renewThumb(id: string): Promise<string | null> {
  try {
    const post = await api<Post>(`/api/posts/${id}`);
    return post.photos[0]?.url ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) await dropPost(id);
    return null;
  }
}
