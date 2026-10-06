import { useState } from 'react';
import { api, message } from '../api';
import { useSession } from '../session';
import { runes } from '../text';
import type { Owner } from '../types';
import { Button, ErrorText, Field, Muted, Screen, Title } from '../ui';

const usernamePattern = /^[A-Za-z0-9_.]{2,30}$/;

export default function UsernameScreen() {
  const { setMe } = useSession();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const username = name.trim();
    if (!usernamePattern.test(username) || username === 'me' || username === 'search') {
      setError('nom invalide');
      return;
    }
    if (runes(username) < 2) {
      setError('nom invalide');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const owner = await api<Owner>('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ username }),
      });
      setMe(owner);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Choisir un nom</Title>
      <Muted>Il est choisi une fois, de 2 à 30 caractères : lettres, chiffres, point et tiret bas.</Muted>
      <Field value={name} onChangeText={setName} placeholder="nom" />
      <ErrorText>{error}</ErrorText>
      <Button label={busy ? 'Enregistrement…' : 'Continuer'} disabled={busy} onPress={() => void save()} />
    </Screen>
  );
}
