import { Pressable, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { BellIcon, PlusIcon, ProfileIcon, SearchIcon } from '../../icons';
import { useSession } from '../../session';
import { colors, Logo } from '../../ui';

export default function TabsLayout() {
  const { bell } = useSession();
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerTitle: '',
        headerStyle: { backgroundColor: colors.bg },
        sceneStyle: { backgroundColor: colors.bg },
        headerLeftContainerStyle: { paddingLeft: 12 },
        headerLeft: () => <CraneMark />,
        headerRightContainerStyle: { paddingRight: 12 },
        headerRight: () => <TopActions marked={bell} />,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: '#888888',
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.line },
      }}
    >
      <Tabs.Screen name="feed" options={{ href: null, title: 'Fil' }} />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Recherche',
          tabBarIcon: ({ color }) => <SearchIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <ProfileIcon color={color} />,
        }}
      />
      <Tabs.Screen name="publish" options={{ href: null, title: 'Publier' }} />
      <Tabs.Screen name="bell" options={{ href: null, title: 'Cloche' }} />
    </Tabs>
  );
}

function CraneMark() {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Instacrane" onPress={() => router.push('/feed')}>
      <Logo size={32} />
    </Pressable>
  );
}

function TopActions({ marked }: { marked: boolean }) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Publier" onPress={() => router.push('/publish')}>
        <PlusIcon />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Cloche" onPress={() => router.push('/bell')}>
        <BellIcon />
        {marked ? (
          <View
            style={{
              position: 'absolute',
              top: 1,
              right: 1,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.mark,
            }}
          />
        ) : null}
      </Pressable>
    </View>
  );
}
