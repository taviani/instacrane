import { Tabs } from 'expo-router';
import { useSession } from '../../session';

export default function TabsLayout() {
  const { bell } = useSession();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#111', tabBarInactiveTintColor: '#888' }}>
      <Tabs.Screen name="feed" options={{ title: 'Fil' }} />
      <Tabs.Screen name="search" options={{ title: 'Recherche' }} />
      <Tabs.Screen name="publish" options={{ title: 'Publier' }} />
      <Tabs.Screen
        name="bell"
        options={{
          title: 'Cloche',
          tabBarBadge: bell ? '' : undefined,
          tabBarBadgeStyle: bell ? { minWidth: 10, maxHeight: 10, borderRadius: 5, backgroundColor: '#c0392b' } : undefined,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
