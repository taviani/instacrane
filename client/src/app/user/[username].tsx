import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api, message } from '../../api';
import { avatarKey } from '../../cache';
import { PhotoGrid } from '../../grid';
import { CachedImage } from '../../images';
import { useSession } from '../../session';
import type { Profile } from '../../types';
import { Button, ConfirmButton, ErrorText, Muted, Title } from '../../ui';
import { Link } from 'expo-router';

export default function UserScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { me, reloadBell } = useSession();
  const [card, setCard] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!username) return;
    try {
      setCard(await api<Profile>(`/api/users/${encodeURIComponent(username)}`));
      setError(null);
    } catch (cause) {
      setError(message(cause));
    }
  }, [username]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!card || !username) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator />}
      </ScrollView>
    );
  }

  const self = me?.username === card.username;
  const profile = card;

  async function follow() {
    setNotice(null);
    try {
      await api(`/api/users/${profile.username}/follow`, { method: 'POST' });
      await load();
      await reloadBell();
    } catch (cause) {
      setNotice(message(cause));
    }
  }

  async function unfollow() {
    try {
      await api(`/api/users/${profile.username}/follow`, { method: 'DELETE' });
      await load();
    } catch (cause) {
      setNotice(message(cause));
    }
  }

  async function block() {
    await api(`/api/users/${profile.username}/block`, { method: 'POST' });
    await load();
  }

  async function unblock() {
    await api(`/api/users/${profile.username}/block`, { method: 'DELETE' });
    await load();
  }

  async function report() {
    await api(`/api/users/${profile.username}/report`, { method: 'POST' });
    setNotice('Signalement envoyé.');
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <CachedImage name={avatarKey(card.username, card.avatar_url)} url={card.avatar_url} style={{ width: 96, height: 96, borderRadius: 48 }} />
      <Title>{card.username}</Title>
      {card.display_name ? <Text>{card.display_name}</Text> : null}
      {card.bio ? <Muted>{card.bio}</Muted> : null}
      <Text>
        <Link href={`/followers/${card.username}`}>{card.followers_count} abonnés</Link>
        {' · '}
        <Link href={`/following/${card.username}`}>{card.following_count} abonnements</Link>
      </Text>
      {card.blocked ? <Muted>Vous avez bloqué ce compte.</Muted> : null}
      {card.follow_request === 'pending' ? <Muted>Les photos restent cachées tant que la demande n’est pas acceptée.</Muted> : null}
      <PhotoGrid username={card.username} />
      {!self && card.follow_request === 'none' ? <Button label="Demander à suivre" onPress={() => void follow()} /> : null}
      {!self && card.follow_request === 'pending' ? <Button label="Annuler la demande" onPress={() => void unfollow()} /> : null}
      {!self && card.follow_request === 'accepted' ? <Button label="Ne plus suivre" onPress={() => void unfollow()} /> : null}
      {!self && card.blocked ? (
        <ConfirmButton label="Débloquer" confirmLabel="Confirmer le déblocage" onConfirm={unblock} />
      ) : null}
      {!self && !card.blocked ? (
        <ConfirmButton label="Bloquer" confirmLabel="Confirmer le blocage" danger onConfirm={block} />
      ) : null}
      {!self && !card.blocked ? (
        <Muted>Bloquer retire son accès à vos photos et l’empêche de redemander à vous suivre.</Muted>
      ) : null}
      {!self ? <ConfirmButton label="Signaler le compte" confirmLabel="Confirmer le signalement" onConfirm={report} /> : null}
      <ErrorText>{error}</ErrorText>
      {notice ? <Muted>{notice}</Muted> : null}
    </ScrollView>
  );
}
