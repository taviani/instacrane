import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { api, message } from '../../api';
import { avatarKey } from '../../cache';
import { PhotoGrid } from '../../grid';
import { CachedImage } from '../../images';
import { appendFile, prepareAvatar } from '../../prepare';
import { useSession } from '../../session';
import { runes } from '../../text';
import type { Owner, Profile } from '../../types';
import { alertsAccepted, setAlertsAccepted } from '../../vault';
import { Button, ConfirmButton, ErrorText, Field, Muted, Title, colors } from '../../ui';

export default function ProfileScreen() {
  const router = useRouter();
  const { me, setMe, logout } = useSession();
  const [displayName, setDisplayName] = useState(me?.display_name ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [alerts, setAlerts] = useState(false);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(me?.display_name ?? '');
    setBio(me?.bio ?? '');
    void alertsAccepted().then(setAlerts);
  }, [me]);

  useEffect(() => {
    if (!me?.username) return;
    void api<Profile>(`/api/users/${encodeURIComponent(me.username)}`)
      .then((card) => setCounts({ followers: card.followers_count, following: card.following_count }))
      .catch(() => undefined);
  }, [me?.username]);

  if (!me?.username) return null;

  async function save() {
    if (runes(displayName.trim()) > 80 || runes(bio.trim()) > 300) {
      setError('texte trop long');
      return;
    }
    setError(null);
    try {
      const owner = await api<Owner>('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ display_name: displayName.trim(), bio: bio.trim() }),
      });
      setMe(owner);
    } catch (cause) {
      setError(message(cause));
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

  async function toggleAlerts(next: boolean) {
    setError(null);
    if (!next) {
      try {
        await api('/api/users/me/alert-token', { method: 'DELETE' });
      } catch (cause) {
        setError(message(cause));
        return;
      }
      await setAlertsAccepted(false);
      setAlerts(false);
      return;
    }
    if (Platform.OS !== 'web') {
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Les alertes restent éteintes.');
        return;
      }
      try {
        const device = await Notifications.getDevicePushTokenAsync();
        const token = typeof device.data === 'string' ? device.data.trim() : '';
        if (token && token.length <= 4096) {
          await api('/api/users/me/alert-token', { method: 'PUT', body: JSON.stringify({ token }) });
        }
      } catch {
        // Accepting still stores nothing when the device has no token.
      }
    }
    await setAlertsAccepted(true);
    setAlerts(true);
  }

  function openPublic() {
    router.push(`/user/${me.username}`);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Pressable onPress={openPublic} accessibilityRole="link">
          <CachedImage name={avatarKey(me.username, me.avatar_url)} url={me.avatar_url} style={{ width: 96, height: 96, borderRadius: 48 }} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-evenly' }}>
          <Pressable onPress={() => router.push(`/followers/${me.username}`)} style={{ alignItems: 'center', gap: 2 }}>
            <Text style={{ fontWeight: '700', fontSize: 18 }}>{counts.followers}</Text>
            <Text>{counts.followers === 1 ? 'abonné' : 'abonnés'}</Text>
          </Pressable>
          <Pressable onPress={() => router.push(`/following/${me.username}`)} style={{ alignItems: 'center', gap: 2 }}>
            <Text style={{ fontWeight: '700', fontSize: 18 }}>{counts.following}</Text>
            <Text>{counts.following === 1 ? 'abonnement' : 'abonnements'}</Text>
          </Pressable>
        </View>
      </View>
      <Pressable onPress={openPublic} accessibilityRole="link">
        <Title>{me.username}</Title>
      </Pressable>
      {me.display_name ? <Text>{me.display_name}</Text> : null}
      {me.bio ? <Muted>{me.bio}</Muted> : null}
      <PhotoGrid username={me.username} />
      <Field value={displayName} onChangeText={setDisplayName} placeholder="Nom affiché" />
      <Field value={bio} onChangeText={setBio} placeholder="Bio" multiline />
      <Button label="Enregistrer le profil" onPress={() => void save()} />
      <Button label="Changer l’avatar" onPress={() => void changeAvatar()} />
      <Button label="Demandes reçues" onPress={() => router.push('/requests')} />
      <Button label={alerts ? 'Retirer les alertes' : 'Accepter les alertes'} onPress={() => void toggleAlerts(!alerts)} />
      {Platform.OS === 'web' && alerts ? <Muted>Sur le web, accepter n’enregistre pas de jeton d’appareil.</Muted> : null}
      <Button label="Données" onPress={() => router.push('/data')} />
      <ErrorText>{error}</ErrorText>
      <ConfirmButton label="Quitter la session" confirmLabel="Quitter" onConfirm={logout} />
    </ScrollView>
  );
}
