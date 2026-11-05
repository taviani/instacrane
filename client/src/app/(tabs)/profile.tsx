import { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { api } from '../../api';
import { GearIcon } from '../../icons';
import { ProfileViewBar, ProfileViewBody, type ProfileView } from '../../profile-posts';
import { ProfileHead } from '../../profile-head';
import { useSession } from '../../session';
import type { Profile } from '../../types';
import { colors } from '../../ui';

export default function ProfileScreen() {
  const { me } = useSession();
  const router = useRouter();
  const navigation = useNavigation();
  const [card, setCard] = useState<Profile | null>(null);
  const [view, setView] = useState<ProfileView>('grid');

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
    <ScrollView stickyHeaderIndices={[1]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16 }}>
        <ProfileHead card={card} />
      </View>
      <ProfileViewBar mode={view} onChange={setView} />
      <ProfileViewBody username={me.username} mode={view} />
    </ScrollView>
  );
}
