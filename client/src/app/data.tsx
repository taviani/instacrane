import { useState } from 'react';
import { api, message } from '../api';
import { useSession } from '../session';
import { clearSession, emit, setAlertsAccepted } from '../vault';
import { Button, ErrorText, Muted, Screen, Title } from '../ui';

export default function DataScreen() {
  const { me } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setError(null);
    try {
      await api('/api/users/me', { method: 'DELETE' });
      await setAlertsAccepted(false);
      await clearSession();
      emit();
    } catch (cause) {
      setError(message(cause));
    }
  }

  return (
    <Screen>
      <Title>Données</Title>
      <Muted>L’adresse email vient de l’issuer. Elle n’est pas modifiable et elle n’est pas montrée aux autres.</Muted>
      <Muted>Email : {me?.email || 'absent'}</Muted>
      <Muted>Le nom d’utilisateur, le nom affiché, la bio et l’avatar servent au profil.</Muted>
      <Muted>Les publications, les demandes de suivi, les likes et les commentaires font le service.</Muted>
      <Muted>Les notifications restent, ainsi que le jeton d’alerte si vous l’avez accepté.</Muted>
      <Muted>Une position n’est gardée que sur la publication dont le bouton était allumé, et elle part avec elle.</Muted>
      <Muted>Supprimer le compte retire ces données. C’est définitif.</Muted>
      <ErrorText>{error}</ErrorText>
      <Button
        label={confirming ? 'Confirmer la suppression' : 'Supprimer mon compte'}
        danger
        onPress={() => void remove()}
      />
    </Screen>
  );
}
