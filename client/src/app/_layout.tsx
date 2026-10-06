import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { ActivityIndicator, View, Platform } from 'react-native';
import { DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { routeAfterSession } from '../login-return';
import { SessionProvider, useSession } from '../session';
import { Button, ErrorText, Screen, Title, colors } from '../ui';

WebBrowser.maybeCompleteAuthSession();

const webFrame = Platform.OS === 'web' ? { height: '100vh' as const, overflow: 'hidden' as const } : null;

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.bg },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ThemeProvider value={theme}>
        <SessionProvider>
          <StatusBar style="dark" />
          <View style={[{ flex: 1, backgroundColor: colors.bg, alignItems: 'center' }, webFrame]}>
            <View style={[{ flex: 1, width: '100%', maxWidth: 480, backgroundColor: colors.bg }, webFrame]}>
              <Gate />
            </View>
          </View>
        </SessionProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function Gate() {
  const { ready, token, me, offline, refreshMe } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready || offline) return;
    const next = routeAfterSession(segments[0], Boolean(token), Boolean(me?.username));
    if (next) router.replace(next);
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
    <Stack
      screenOptions={{
        headerTintColor: '#111',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
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
