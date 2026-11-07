import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { api, message } from '../../api';
import { KeyboardScroll } from '../../keyboard-scroll';
import { openPublishPicker } from '../../publish-menu';
import { rememberPhotoPlace, subscribeDrafts, takeDrafts } from '../../publish-draft';
import { appendFile, type Draft } from '../../prepare';
import { placeText, runes } from '../../text';
import type { Coords, Post } from '../../types';
import { Button, ErrorText, Field, Muted, Title } from '../../ui';

export default function PublishScreen() {
  const router = useRouter();
  const [photos, setPhotos] = useState<Draft[]>([]);
  const [caption, setCaption] = useState('');
  const [place, setPlace] = useState<Coords | null>(null);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    if (runes(caption.trim()) > 2200) {
      setError('légende invalide');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      for (const photo of photos) await appendFile(form, photo.uri);
      const text = caption.trim();
      if (text) form.append('caption', text);
      if (place) {
        form.append('latitude', String(place.latitude));
        form.append('longitude', String(place.longitude));
      }
      const created = await api<Post>('/api/posts', { method: 'POST', body: form });
      rememberPhotoPlace(created.id, photos);
      setPhotos([]);
      setCaption('');
      setPlace(null);
      setPlaceOpen(false);
      router.replace('/feed');
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardScroll>
      <Title>Publier</Title>
      <Button
        label="Ajouter"
        onPress={() => openPublishPicker((picked) => setPhotos((current) => [...current, ...picked].slice(0, 20)))}
      />
      <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
        {photos.map((photo, index) => (
          <View key={photo.uri} style={{ gap: 4 }}>
            <Image source={{ uri: photo.uri }} style={{ width: 96, height: 120 }} />
            {photos.length > 1 && index > 0 ? <Pressable onPress={() => move(index, -1)}><Text>Monter</Text></Pressable> : null}
            {photos.length > 1 && index < photos.length - 1 ? <Pressable onPress={() => move(index, 1)}><Text>Descendre</Text></Pressable> : null}
            <Pressable onPress={() => remove(index)}><Text>Retirer</Text></Pressable>
          </View>
        ))}
      </ScrollView>
      <Field value={caption} onChangeText={setCaption} placeholder="Légende" multiline autoCapitalize="sentences" />
      {place ? <Muted>{placeText(place.latitude, place.longitude)}</Muted> : null}
      {!placeOpen ? (
        <Pressable onPress={() => setPlaceOpen(true)}>
          <Muted>{place ? 'Modifier la position' : 'Ajouter une position'}</Muted>
        </Pressable>
      ) : (
        <View style={{ gap: 8 }}>
          <Muted>Une seule source. L’autre est oubliée.</Muted>
          <Button label="Position du moment" onPress={() => void useHere()} />
          <Button label="Position de la photo" onPress={usePhoto} />
          {place ? <Button label="Retirer la position" onPress={() => { setPlace(null); setPlaceOpen(false); }} /> : null}
        </View>
      )}
      <ErrorText>{error}</ErrorText>
      <Button label={busy ? 'Envoi…' : 'Publier'} disabled={busy} onPress={() => void publish()} />
    </KeyboardScroll>
  );

  async function useHere() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      setError('Position indisponible.');
      return;
    }
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setPlace({ latitude: current.coords.latitude, longitude: current.coords.longitude });
    setPlaceOpen(false);
    setError(null);
  }

  function usePhoto() {
    const found = photos.find((photo) => photo.gps);
    if (!found?.gps) {
      setError('Cette photo n’a pas de position.');
      return;
    }
    setPlace(found.gps);
    setPlaceOpen(false);
    setError(null);
  }

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

