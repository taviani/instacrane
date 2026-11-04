import { useEffect, useState } from 'react';
import { Platform, ScrollView } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { api, message } from '../api';
import { useSession } from '../session';
import { alertsAccepted, setAlertsAccepted } from '../vault';
import { Button, ConfirmButton, ErrorText, Muted, colors } from '../ui';

export default function SettingsScreen() {
  const router = useRouter();
  const { logout } = useSession();
  const [alerts, setAlerts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void alertsAccepted().then(setAlerts);
  }, []);

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

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Button label="Modifier le profil" onPress={() => router.push('/edit-profile')} />
      <Button label="Demandes reçues" onPress={() => router.push('/requests')} />
      <Button label={alerts ? 'Retirer les alertes' : 'Accepter les alertes'} onPress={() => void toggleAlerts(!alerts)} />
      {Platform.OS === 'web' && alerts ? <Muted>Sur le web, accepter n’enregistre pas de jeton d’appareil.</Muted> : null}
      <Button label="Données" onPress={() => router.push('/data')} />
      <ErrorText>{error}</ErrorText>
      <ConfirmButton label="Quitter la session" confirmLabel="Quitter" onConfirm={logout} />
    </ScrollView>
  );
}
