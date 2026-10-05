import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, message } from '../../api';
import { avatarKey } from '../../cache';
import { CachedImage } from '../../images';
import { useSession } from '../../session';
import { cursor, noteText } from '../../text';
import type { Note } from '../../types';
import { Button, ErrorText, Muted, Screen } from '../../ui';

export default function BellScreen() {
  const router = useRouter();
  const { reloadBell } = useSession();
  const [notes, setNotes] = useState<Note[]>([]);
  const [cursorValue, setCursorValue] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (before: string | null, replace: boolean) => {
    setError(null);
    try {
      const query = new URLSearchParams({ limit: '20' });
      if (before) query.set('before', before);
      const page = await api<{ bell: boolean; notifications: Note[] }>(`/api/notifications?${query}`);
      const items = page.notifications ?? [];
      setNotes((current) => (replace ? items : [...current, ...items]));
      const last = items.at(-1);
      setCursorValue(last ? cursor(last.created_at, last.id) : before);
      setDone(items.length < 20);
      await reloadBell();
    } catch (cause) {
      setError(message(cause));
    }
  }, [reloadBell]);

  useEffect(() => {
    void load(null, true);
  }, [load]);

  async function markRead() {
    setError(null);
    try {
      await api('/api/notifications/read', { method: 'POST' });
      setNotes((current) => current.map((note) => ({ ...note, is_read: true })));
      await reloadBell();
    } catch (cause) {
      setError(message(cause));
    }
  }

  return (
    <Screen>
      <Button label="Demandes reçues" onPress={() => router.push('/requests')} />
      <Button label="Marquer comme lu" onPress={() => void markRead()} />
      <ErrorText>{error}</ErrorText>
      <FlatList
        style={{ flex: 1 }}
        data={notes}
        keyExtractor={(item) => item.id}
        onEndReached={() => {
          if (!done && cursorValue) void load(cursorValue, false);
        }}
        ListEmptyComponent={<Muted>Aucune notification.</Muted>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => (item.post_id ? router.push(`/post/${item.post_id}`) : router.push('/requests'))}
            style={{ paddingVertical: 12, gap: 4, opacity: item.is_read ? 0.55 : 1 }}
          >
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <CachedImage
                name={avatarKey(item.actor.username ?? item.id, item.actor.avatar_url)}
                url={item.actor.avatar_url}
                style={{ width: 36, height: 36, borderRadius: 18 }}
              />
              <Text>{noteText(item)}</Text>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}
