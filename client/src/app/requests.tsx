import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, message } from '../api';
import { avatarKey } from '../cache';
import { CachedImage } from '../images';
import { useSession } from '../session';
import type { Person } from '../types';
import { Button, ErrorText, Muted } from '../ui';

export default function RequestsScreen() {
  const router = useRouter();
  const { reloadBell } = useSession();
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const page = await api<{ users: Person[] }>('/api/users/me/follow-requests');
      setPeople(page.users ?? []);
      setError(null);
      await reloadBell();
    } catch (cause) {
      setError(message(cause));
    }
  }, [reloadBell]);

  useEffect(() => {
    void load();
  }, [load]);

  async function answer(username: string, accept: boolean) {
    setError(null);
    try {
      if (accept) await api(`/api/users/${encodeURIComponent(username)}/follow/accept`, { method: 'POST' });
      else await api(`/api/users/${encodeURIComponent(username)}/follow/request`, { method: 'DELETE' });
      await load();
    } catch (cause) {
      setError(message(cause));
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <ErrorText>{error}</ErrorText>
      {people.length === 0 && !error ? <Muted>Aucune demande en attente.</Muted> : null}
      {people.map((person) => (
        <View key={person.username} style={{ gap: 8, paddingVertical: 8 }}>
          <Pressable onPress={() => router.push(`/user/${person.username}`)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <CachedImage name={avatarKey(person.username, person.avatar_url)} url={person.avatar_url} style={{ width: 40, height: 40, borderRadius: 20 }} />
            <Text style={{ fontWeight: '700' }}>{person.username}</Text>
          </Pressable>
          <Button label="Accepter" onPress={() => void answer(person.username, true)} />
          <Button label="Refuser" onPress={() => void answer(person.username, false)} />
        </View>
      ))}
    </ScrollView>
  );
}
