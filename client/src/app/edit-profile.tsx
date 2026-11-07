import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { api, message } from '../api';
import { KeyboardScroll } from '../keyboard-scroll';
import { appendFile, prepareAvatar } from '../prepare';
import { useSession } from '../session';
import { runes } from '../text';
import type { Owner } from '../types';
import { Button, ErrorText, Field } from '../ui';

export default function EditProfileScreen() {
  const { me, setMe } = useSession();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(me?.display_name ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (runes(displayName.trim()) > 80 || runes(bio.trim()) > 300) {
      setError('texte trop long');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const owner = await api<Owner>('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ display_name: displayName.trim(), bio: bio.trim() }),
      });
      setMe(owner);
      router.dismissTo('/(tabs)/profile');
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  async function changeAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    setError(null);
    try {
      const uri = await prepareAvatar(result.assets[0]);
      const form = new FormData();
      await appendFile(form, uri);
      const owner = await api<Owner>('/api/users/me/avatar', { method: 'POST', body: form });
      setMe(owner);
    } catch (cause) {
      setError(message(cause));
    }
  }

  return (
    <KeyboardScroll>
      <Field value={displayName} onChangeText={setDisplayName} placeholder="Nom affiché" autoCapitalize="words" />
      <Field value={bio} onChangeText={setBio} placeholder="Bio" multiline autoCapitalize="sentences" />
      <Button label={busy ? 'Enregistrement…' : 'Enregistrer le profil'} disabled={busy} onPress={() => void save()} />
      <Button label="Changer l’avatar" onPress={() => void changeAvatar()} />
      <ErrorText>{error}</ErrorText>
    </KeyboardScroll>
  );
}
