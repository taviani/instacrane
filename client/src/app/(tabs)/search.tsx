import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, message } from '../../api';
import { avatarKey } from '../../cache';
import { CachedImage } from '../../images';
import type { Person } from '../../types';
import { Button, ErrorText, Field, Muted, Screen } from '../../ui';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function search() {
    const text = query.trim();
    if (!text) return;
    setError(null);
    try {
      const page = await api<{ users: Person[] }>(`/api/users/search/${encodeURIComponent(text)}`);
      setPeople(page.users ?? []);
      setSearched(true);
    } catch (cause) {
      setError(message(cause));
    }
  }

  return (
    <Screen>
      <Field value={query} onChangeText={setQuery} placeholder="Nom ou nom affiché" />
      <Button label="Chercher" onPress={() => void search()} />
      <ErrorText>{error}</ErrorText>
      <FlatList
        style={{ flex: 1 }}
        data={people}
        keyExtractor={(item) => item.username}
        ListEmptyComponent={searched ? <Muted>Aucun compte.</Muted> : null}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/user/${item.username}`)} style={{ paddingVertical: 10, flexDirection: 'row', gap: 12 }}>
            <CachedImage name={avatarKey(item.username, item.avatar_url)} url={item.avatar_url} style={{ width: 48, height: 48, borderRadius: 24 }} />
            <View>
              <Text style={{ fontWeight: '700' }}>{item.username}</Text>
              {item.display_name ? <Text>{item.display_name}</Text> : null}
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}
