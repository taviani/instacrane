import {
  AuthRequest,
  ResponseType,
  TokenError,
  exchangeCodeAsync,
  fetchDiscoveryAsync,
  makeRedirectUri,
  refreshAsync,
  type TokenResponse,
} from 'expo-auth-session';
import { config } from './config';
import { clearSession, emit, readSession, writeSession, type StoredSession } from './vault';

export type RefreshResult = { ok: true; token: string } | { ok: false; reason: 'network' | 'rejected' };

let flight: Promise<RefreshResult> | null = null;

export function refreshSession(): Promise<RefreshResult> {
  if (!flight) {
    flight = runRefresh().finally(() => {
      flight = null;
    });
  }
  return flight;
}

export async function login(): Promise<boolean> {
  const current = config();
  if (!current.apiUrl || !current.issuerUrl || !current.clientId) {
    throw new Error('configuration locale absente');
  }
  const redirectUri = makeRedirectUri({ scheme: 'instacrane', path: 'redirect' });
  const discovery = await fetchDiscoveryAsync(current.issuerUrl);
  const request = new AuthRequest({
    clientId: current.clientId,
    scopes: ['openid', 'email'],
    redirectUri,
    responseType: ResponseType.Code,
    usePKCE: true,
  });
  const result = await request.promptAsync(discovery);
  if (result.type === 'cancel' || result.type === 'dismiss') return false;
  if (result.type !== 'success' || !result.params.code || !request.codeVerifier) {
    throw new Error('connexion interrompue');
  }
  const token = await exchangeCodeAsync(
    {
      clientId: current.clientId,
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier },
    },
    discovery,
  );
  await storeToken(token, null);
  emit();
  return true;
}

async function runRefresh(): Promise<RefreshResult> {
  const current = await readSession();
  if (!current?.accessToken) return { ok: false, reason: 'rejected' };
  if (!current.refreshToken) return { ok: true, token: current.accessToken };
  const settings = config();
  if (!settings.issuerUrl || !settings.clientId) return { ok: true, token: current.accessToken };
  try {
    const discovery = await fetchDiscoveryAsync(settings.issuerUrl);
    const next = await refreshAsync({ clientId: settings.clientId, refreshToken: current.refreshToken }, discovery);
    await storeToken(next, current);
    emit();
    return { ok: true, token: next.accessToken };
  } catch (error) {
    if (error instanceof TokenError) {
      await clearSession();
      emit();
      return { ok: false, reason: 'rejected' };
    }
    return { ok: false, reason: 'network' };
  }
}

async function storeToken(token: TokenResponse, previous: StoredSession | null): Promise<void> {
  await writeSession({
    accessToken: token.accessToken,
    refreshToken: token.refreshToken ?? previous?.refreshToken,
    issuedAt: token.issuedAt,
    expiresIn: token.expiresIn,
  });
}
