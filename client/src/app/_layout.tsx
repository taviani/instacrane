import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SessionProvider, useSession } from '../session';
import { Button, ErrorText, Screen, Title } from '../ui';

WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider>
        <StatusBar style="dark" />
        <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center' }}>
          <View style={{ flex: 1, width: '100%', maxWidth: 480 }}>
            <Gate />
          </View>
        </View>
      </SessionProvider>
    </GestureHandlerRootView>
  );
}

function Gate() {
  const { ready, token, me, offline, refreshMe } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready || offline) return;
    const top = segments[0];
    if (!token) {
      if (top !== 'login' && top !== 'redirect') router.replace('/login');
      return;
    }
    if (!me?.username) {
      if (top !== 'username') router.replace('/username');
      return;
    }
    if (!top || top === 'login' || top === 'username' || top === 'index') router.replace('/(tabs)/feed');
  }, [ready, offline, token, me, segments, router]);

  if (!ready) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }
  if (offline && token && !me) {
    return (
      <Screen>
        <Title>Réseau indisponible</Title>
        <ErrorText>La session reste ouverte.</ErrorText>
        <Button label="Réessayer" onPress={() => void refreshMe()} />
      </Screen>
    );
  }
  return (
    <Stack screenOptions={{ headerTintColor: '#111', headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="redirect" options={{ headerShown: false }} />
      <Stack.Screen name="username" options={{ title: 'Nom d’utilisateur', headerBackVisible: false }} />
      <Stack.Screen name="post/[id]" options={{ title: 'Publication' }} />
      <Stack.Screen name="user/[username]" options={{ title: 'Profil' }} />
      <Stack.Screen name="followers/[username]" options={{ title: 'Abonnés' }} />
      <Stack.Screen name="following/[username]" options={{ title: 'Abonnements' }} />
      <Stack.Screen name="requests" options={{ title: 'Demandes reçues' }} />
      <Stack.Screen name="data" options={{ title: 'Données' }} />
    </Stack>
  );
}
