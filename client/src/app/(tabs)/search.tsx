import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, message } from '../../api';
import { avatarKey } from '../../cache';
import { CachedImage } from '../../images';
import { PostCard } from '../../post-card';
import type { Person, Post } from '../../types';
import { Button, ErrorText, Field, Muted, colors } from '../../ui';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function search() {
    const text = query.trim();
    if (!text) return;
    setError(null);
    try {
      const page = await api<{ users: Person[]; posts: Post[] }>(`/api/users/search/${encodeURIComponent(text)}`);
      setPeople(page.users ?? []);
      setPosts(page.posts ?? []);
      setSearched(true);
    } catch (cause) {
      setError(message(cause));
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Field value={query} onChangeText={setQuery} placeholder="Nom, bio ou légende" />
      <Button label="Chercher" onPress={() => void search()} />
      <ErrorText>{error}</ErrorText>
      {searched && people.length === 0 && posts.length === 0 ? <Muted>Aucun résultat.</Muted> : null}
      {people.map((item) => (
        <Pressable key={item.username} onPress={() => router.push(`/user/${item.username}`)} style={{ paddingVertical: 10, flexDirection: 'row', gap: 12 }}>
          <CachedImage name={avatarKey(item.username, item.avatar_url)} url={item.avatar_url} style={{ width: 48, height: 48, borderRadius: 24 }} />
          <View>
            <Text style={{ fontWeight: '700' }}>{item.username}</Text>
            {item.display_name ? <Text>{item.display_name}</Text> : null}
          </View>
        </Pressable>
      ))}
      {posts.map((item) => (
        <PostCard
          key={item.id}
          post={item}
          onChange={(next) => setPosts((current) => current.map((post) => (post.id === next.id ? next : post)))}
          onGone={() => setPosts((current) => current.filter((post) => post.id !== item.id))}
        />
      ))}
    </ScrollView>
  );
}
