export type ClientConfig = {
  apiUrl: string;
  issuerUrl: string;
  clientId: string;
};

function clean(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/$/, '');
}

export function config(): ClientConfig {
  return {
    apiUrl: clean(process.env.EXPO_PUBLIC_API_URL),
    issuerUrl: clean(process.env.EXPO_PUBLIC_ISSUER_URL),
    clientId: (process.env.EXPO_PUBLIC_CLIENT_ID ?? '').trim(),
  };
}

export function authConfigured(): boolean {
  const current = config();
  return Boolean(current.apiUrl && current.issuerUrl && current.clientId);
}
