import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, message } from '../../api';
import { PostCard } from '../../post-card';
import { cursor } from '../../text';
import type { Post } from '../../types';
import { ErrorText, Muted, Button, colors } from '../../ui';

export default function FeedScreen() {
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

  useFocusEffect(useCallback(() => {
    void load(null, true);
  }, [load]));

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
        <PostCard
          post={item}
          onChange={(next) => setPosts((current) => current.map((post) => (post.id === next.id ? next : post)))}
          onGone={() => setPosts((current) => current.filter((post) => post.id !== item.id))}
        />
      )}
    />
  );
}
