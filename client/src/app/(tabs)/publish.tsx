import { useState } from 'react';
import { Image, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { api, message } from '../../api';
import { appendFile, preparePhoto, type Draft } from '../../prepare';
import { runes } from '../../text';
import type { Coords, Post } from '../../types';
import { Button, ErrorText, Field, Muted, Title } from '../../ui';

type Place = Coords & { source: 'now' | 'photo' };

export default function PublishScreen() {
  const router = useRouter();
  const [photos, setPhotos] = useState<Draft[]>([]);
  const [caption, setCaption] = useState('');
  const [located, setLocated] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 20,
      exif: true,
      quality: 1,
    });
    if (result.canceled) return;
    const assets = result.assets.filter((asset) => asset.type !== 'video').slice(0, 20);
    try {
      const prepared = await Promise.all(assets.map((asset) => preparePhoto(asset)));
      setPhotos(prepared);
      setPlace((current) => (current?.source === 'photo' ? photoPlace(prepared) : current));
    } catch (cause) {
      setError(message(cause));
    }
  }

  function choosePhoto() {
    const next = photoPlace(photos);
    if (!next) {
      setPlace(null);
      setError('Cette photo n’a pas de position.');
      return;
    }
    setError(null);
    setPlace(next);
  }

  async function chooseNow() {
    setError(null);
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      setPlace(null);
      setError('Position indisponible.');
      return;
    }
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setPlace({ latitude: current.coords.latitude, longitude: current.coords.longitude, source: 'now' });
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
    if (located && !place) {
      setError('Choisissez une seule source de position.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      const text = caption.trim();
      if (text) form.append('caption', text);
      if (located && place) {
        form.append('latitude', String(place.latitude));
        form.append('longitude', String(place.longitude));
      }
      for (const photo of photos) await appendFile(form, photo.uri);
      const created = await api<Post>('/api/posts', { method: 'POST', body: form });
      setPhotos([]);
      setCaption('');
      setLocated(false);
      setPlace(null);
      router.push(`/post/${created.id}`);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Title>Publier</Title>
      <Button label="Choisir des photos" onPress={() => void pick()} />
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
      <Field value={caption} onChangeText={setCaption} placeholder="Légende" multiline />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>Ajouter une position</Text>
        <Switch
          value={located}
          onValueChange={(value) => {
            setLocated(value);
            if (!value) setPlace(null);
          }}
        />
      </View>
      {located ? (
        <View style={{ gap: 8 }}>
          <Muted>Une seule source. L’autre est oubliée.</Muted>
          <Button label="Position du moment" onPress={() => void chooseNow()} />
          <Button label="Position de la photo" onPress={choosePhoto} />
          {place ? <Muted>{place.source === 'now' ? 'Position du moment' : 'Position de la photo'}</Muted> : null}
        </View>
      ) : null}
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

function photoPlace(photos: Draft[]): Place | null {
  const found = photos.find((photo) => photo.gps);
  if (!found?.gps) return null;
  return { ...found.gps, source: 'photo' };
}
