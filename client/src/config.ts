export type ClientConfig = {
  apiUrl: string;
  issuerUrl: string;
  clientId: string;
  siteUrl: string;
  iosStoreUrl: string;
  androidStoreUrl: string;
};

function clean(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/$/, '');
}

export function config(): ClientConfig {
  return {
    apiUrl: clean(process.env.EXPO_PUBLIC_API_URL),
    issuerUrl: clean(process.env.EXPO_PUBLIC_ISSUER_URL),
    clientId: (process.env.EXPO_PUBLIC_CLIENT_ID ?? '').trim(),
    siteUrl: clean(process.env.EXPO_PUBLIC_SITE_URL),
    iosStoreUrl: clean(process.env.EXPO_PUBLIC_IOS_STORE_URL),
    androidStoreUrl: clean(process.env.EXPO_PUBLIC_ANDROID_STORE_URL),
  };
}

export function authConfigured(): boolean {
  const current = config();
  return Boolean(current.issuerUrl && current.clientId);
}
