import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { inviteDismissKey, isMobileBrowser, storeUrlFor } from './app-invite';
import { publicationAppLink } from './permalink';
import { config } from './config';
import { Button, colors } from './ui';

export function OpenAppBanner({ id }: { id: string }) {
  const [visible, setVisible] = useState(false);
  const [store, setStore] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof navigator === 'undefined') return;
    const ua = navigator.userAgent;
    if (!isMobileBrowser(ua)) return;
    if (sessionStorage.getItem(inviteDismissKey(id))) return;
    const settings = config();
    setStore(storeUrlFor(ua, { ios: settings.iosStoreUrl, android: settings.androidStoreUrl }));
    setVisible(true);
  }, [id]);

  if (!visible) return null;

  function dismiss() {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(inviteDismissKey(id), '1');
    setVisible(false);
  }

  function openApp() {
    const link = publicationAppLink(id);
    if (!link || typeof window === 'undefined') return;
    window.location.assign(link);
  }

  function install() {
    if (!store || typeof window === 'undefined') return;
    window.location.assign(store);
  }

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 12,
        gap: 10,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 8,
        backgroundColor: colors.soft,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>Instacrane sur le téléphone</Text>
      <Text style={{ color: colors.muted, fontSize: 14 }}>Ouvrir cette publication dans l’application, ou l’installer.</Text>
      <View style={{ gap: 8 }}>
        <Button label="Ouvrir l’app" onPress={openApp} />
        {store ? <Button label="Installer" onPress={install} /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Rester sur le site" onPress={dismiss} hitSlop={8}>
          <Text style={{ color: colors.muted, fontSize: 14, textAlign: 'center' }}>Rester sur le site</Text>
        </Pressable>
      </View>
    </View>
  );
}
