import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { appLinkForPath, isMobileBrowser, storeUrlFor } from './app-invite';
import { config } from './config';
import { colors } from './ui';

/** Bannière fixe sur la web app mobile, comme Instagram : toujours visible. */
export function OpenAppBanner() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [store, setStore] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;
    const ua = navigator.userAgent;
    if (!isMobileBrowser(ua)) return;
    const settings = config();
    setStore(storeUrlFor(ua, { ios: settings.iosStoreUrl, android: settings.androidStoreUrl }));
    setActive(true);
  }, []);

  if (!active) return null;

  function openApp() {
    if (typeof window === 'undefined') return;
    const link = appLinkForPath(pathname);
    if (!link) return;
    window.location.assign(link);
  }

  function install() {
    if (!store || typeof window === 'undefined') return;
    window.location.assign(store);
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
        backgroundColor: colors.bg,
      }}
    >
      <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
        Instacrane
      </Text>
      {store ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Installer" onPress={install} hitSlop={6}>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600' }}>Installer</Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ouvrir l’app"
        onPress={openApp}
        style={{
          backgroundColor: colors.text,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: colors.bg, fontSize: 14, fontWeight: '700' }}>Ouvrir</Text>
      </Pressable>
    </View>
  );
}
