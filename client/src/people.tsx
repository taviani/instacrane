import { useEffect, useState } from 'react';
import { ScrollView, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, message } from './api';
import { avatarKey } from './cache';
import { CachedImage } from './images';
import type { Person } from './types';
import { ErrorText, Muted } from './ui';

export function PeopleList({ path }: { path: string }) {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<{ users: Person[] }>(path)
      .then((page) => setPeople(page.users ?? []))
      .catch((cause) => setError(message(cause)));
  }, [path]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
      <ErrorText>{error}</ErrorText>
      {people.length === 0 && !error ? <Muted>Aucun compte.</Muted> : null}
      {people.map((person) => (
        <Pressable key={person.username} onPress={() => router.push(`/user/${person.username}`)} style={{ flexDirection: 'row', gap: 12, paddingVertical: 8 }}>
          <CachedImage name={avatarKey(person.username, person.avatar_url)} url={person.avatar_url} style={{ width: 40, height: 40, borderRadius: 20 }} />
          <View>
            <Text style={{ fontWeight: '700' }}>{person.username}</Text>
            {person.display_name ? <Text>{person.display_name}</Text> : null}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
