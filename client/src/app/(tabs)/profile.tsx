import { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { api } from '../../api';
import { PhotoGrid } from '../../grid';
import { GearIcon } from '../../icons';
import { ProfileHead } from '../../profile-head';
import { useSession } from '../../session';
import type { Profile } from '../../types';
import { colors } from '../../ui';

export default function ProfileScreen() {
  const { me } = useSession();
  const router = useRouter();
  const navigation = useNavigation();
  const [card, setCard] = useState<Profile | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable accessibilityRole="button" accessibilityLabel="Réglages" onPress={() => router.push('/settings')}>
          <GearIcon />
        </Pressable>
      ),
    });
  }, [navigation, router]);

  useEffect(() => {
    if (!me?.username) return;
    void api<Profile>(`/api/users/${encodeURIComponent(me.username)}`)
      .then(setCard)
      .catch(() => undefined);
  }, [me?.username, me?.display_name, me?.bio, me?.avatar_url]);

  if (!me?.username) return null;
  if (!card) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
        <ActivityIndicator />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <ProfileHead card={card} />
      <PhotoGrid username={me.username} />
    </ScrollView>
  );
}
