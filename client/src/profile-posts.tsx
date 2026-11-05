import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { api, message } from './api';
import { PhotoGrid } from './grid';
import { GridIcon, RowsIcon } from './icons';
import { PostCard } from './post-card';
import { cursor } from './text';
import type { Post } from './types';
import { Button, ErrorText, Muted, colors } from './ui';

export type ProfileView = 'grid' | 'feed';

export function ProfileViewBar({ mode, onChange }: { mode: ProfileView; onChange: (mode: ProfileView) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <ViewChoice label="Grille" selected={mode === 'grid'} onPress={() => onChange('grid')}>
        <GridIcon color={mode === 'grid' ? colors.text : colors.muted} />
      </ViewChoice>
      <ViewChoice label="Publications à la suite" selected={mode === 'feed'} onPress={() => onChange('feed')}>
        <RowsIcon color={mode === 'feed' ? colors.text : colors.muted} />
      </ViewChoice>
    </View>
  );
}

function ViewChoice({
  label,
  selected,
  onPress,
  children,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: selected ? colors.text : 'transparent' }}
    >
      {children}
    </Pressable>
  );
}

export function ProfileViewBody({ username, mode }: { username: string; mode: ProfileView }) {
  const [feedOpened, setFeedOpened] = useState(mode === 'feed');
  useEffect(() => {
    if (mode === 'feed') setFeedOpened(true);
  }, [mode]);
  return (
    <View>
      <View style={{ display: mode === 'grid' ? 'flex' : 'none', paddingHorizontal: 16, paddingTop: 8 }}>
        <PhotoGrid username={username} />
      </View>
      {feedOpened ? (
        <View style={{ display: mode === 'feed' ? 'flex' : 'none', paddingTop: 8 }}>
          <ProfileFeed username={username} />
        </View>
      ) : null}
    </View>
  );
}

function ProfileFeed({ username }: { username: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursorValue, setCursorValue] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (before: string | null, replace: boolean) => {
    try {
      const query = new URLSearchParams({ limit: '12', full: '1' });
      if (before) query.set('before', before);
      const page = await api<{ posts: Post[] }>(`/api/users/${encodeURIComponent(username)}/posts?${query}`);
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
      {posts.map((item) => (
        <PostCard
          key={item.id}
          post={item}
          onChange={(next) => setPosts((current) => current.map((post) => (post.id === next.id ? next : post)))}
          onGone={() => setPosts((current) => current.filter((post) => post.id !== item.id))}
        />
      ))}
      {!done && cursorValue ? (
        <View style={{ paddingHorizontal: 16 }}>
          <Button label="Plus anciennes" onPress={() => void load(cursorValue, false)} />
        </View>
      ) : null}
    </View>
  );
}
