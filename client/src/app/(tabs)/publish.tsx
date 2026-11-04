import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, message } from '../../api';
import { PublishMenu } from '../../publish-menu';
import { rememberPhotoPlace, subscribeDrafts, takeDrafts } from '../../publish-draft';
import { appendFile, type Draft } from '../../prepare';
import type { Post } from '../../types';
import { Button, ErrorText, Title, colors } from '../../ui';

export default function PublishScreen() {
  const router = useRouter();
  const [photos, setPhotos] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const staged = takeDrafts();
    if (staged) replace(staged);
    return subscribeDrafts(replace);
  }, []);

  function replace(next: Draft[]) {
    setPhotos(next);
    setError(null);
  }

  async function publish() {
    if (photos.length < 1 || photos.length > 20) {
      setError('Une publication contient de une à vingt photos.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      for (const photo of photos) await appendFile(form, photo.uri);
      const created = await api<Post>('/api/posts', { method: 'POST', body: form });
      rememberPhotoPlace(created.id, photos);
      setPhotos([]);
      router.replace('/feed');
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Title>Publier</Title>
      <Button label="Ajouter" onPress={() => setMenu(true)} />
      <PublishMenu
        visible={menu}
        onClose={() => setMenu(false)}
        onPicked={(picked) => setPhotos((current) => [...current, ...picked].slice(0, 20))}
      />
      <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
        {photos.map((photo, index) => (
          <View key={photo.uri} style={{ gap: 4 }}>
            <Image source={{ uri: photo.uri }} style={{ width: 96, height: 120 }} />
            <Pressable onPress={() => move(index, -1)}><Text>Monter</Text></Pressable>
            <Pressable onPress={() => move(index, 1)}><Text>Descendre</Text></Pressable>
            <Pressable onPress={() => remove(index)}><Text>Retirer</Text></Pressable>
          </View>
        ))}
      </ScrollView>
      <ErrorText>{error}</ErrorText>
      <Button label={busy ? 'Envoi…' : 'Publier'} disabled={busy} onPress={() => void publish()} />
    </ScrollView>
  );

  function move(index: number, delta: number) {
    setPhotos((current) => {
      const next = current.slice();
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function remove(index: number) {
    setPhotos((current) => current.filter((_, item) => item !== index));
  }
}

