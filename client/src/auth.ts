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
import { Platform } from 'react-native';
import { config } from './config';
import { clearSession, emit, readSession, writeSession, type StoredSession } from './vault';

export type RefreshResult = { ok: true; token: string } | { ok: false; reason: 'network' | 'rejected' };

let flight: Promise<RefreshResult> | null = null;

type PreparedLogin = {
  discovery: Awaited<ReturnType<typeof fetchDiscoveryAsync>>;
  request: AuthRequest;
};

let prepared: PreparedLogin | null = null;
let preparing: Promise<void> | null = null;

const pendingKey = 'instacrane.login';
const loginErrorKey = 'instacrane.login-error';

type PendingLogin = {
  verifier: string;
  state: string;
  redirectUri: string;
  clientId: string;
};

function redirectUri(): string {
  return makeRedirectUri({ scheme: 'instacrane', path: 'redirect' });
}

export function prepareLogin(): Promise<void> {
  if (prepared?.request.url) return Promise.resolve();
  if (!preparing) {
    preparing = buildLogin().finally(() => {
      preparing = null;
    });
  }
  return preparing;
}

async function buildLogin(): Promise<void> {
  const current = config();
  if (!current.apiUrl || !current.issuerUrl || !current.clientId) {
    throw new Error('configuration locale absente');
  }
  const discovery = await fetchDiscoveryAsync(current.issuerUrl);
  const request = new AuthRequest({
    clientId: current.clientId,
    scopes: ['openid', 'email'],
    redirectUri: redirectUri(),
    responseType: ResponseType.Code,
    usePKCE: true,
  });
  await request.makeAuthUrlAsync(discovery);
  prepared = { discovery, request };
}

export function refreshSession(): Promise<RefreshResult> {
  if (!flight) {
    flight = runRefresh().finally(() => {
      flight = null;
    });
  }
  return flight;
}

export function takeLoginError(): string | null {
  if (Platform.OS !== 'web') return null;
  const value = sessionStorage.getItem(loginErrorKey);
  if (value) sessionStorage.removeItem(loginErrorKey);
  return value;
}

export async function completeWebLogin(): Promise<'ok' | 'failed' | 'none'> {
  if (Platform.OS !== 'web') return 'none';
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const returnedState = params.get('state');
  const error = params.get('error');
  if (!code && !error) return 'none';
  const raw = sessionStorage.getItem(pendingKey);
  sessionStorage.removeItem(pendingKey);
  if (!raw) return 'none';
  let saved: PendingLogin;
  try {
    saved = JSON.parse(raw) as PendingLogin;
  } catch {
    sessionStorage.setItem(loginErrorKey, 'connexion interrompue');
    return 'failed';
  }
  if (error || !code || returnedState !== saved.state || !saved.verifier) {
    sessionStorage.setItem(loginErrorKey, 'connexion interrompue');
    return 'failed';
  }
  const settings = config();
  if (!settings.issuerUrl) {
    sessionStorage.setItem(loginErrorKey, 'configuration locale absente');
    return 'failed';
  }
  try {
    const discovery = await fetchDiscoveryAsync(settings.issuerUrl);
    const token = await exchangeCodeAsync(
      {
        clientId: saved.clientId,
        code,
        redirectUri: saved.redirectUri,
        extraParams: { code_verifier: saved.verifier },
      },
      discovery,
    );
    await storeToken(token, null);
    emit();
    return 'ok';
  } catch (cause) {
    sessionStorage.setItem(loginErrorKey, cause instanceof Error ? cause.message : 'connexion interrompue');
    return 'failed';
  }
}

export async function login(): Promise<boolean> {
  const settings = config();
  const current = prepared;
  if (!current?.request.url || !settings.clientId || !current.request.codeVerifier) {
    throw new Error('connexion pas prête');
  }
  if (Platform.OS === 'web') {
    const pending: PendingLogin = {
      verifier: current.request.codeVerifier,
      state: current.request.state,
      redirectUri: current.request.redirectUri,
      clientId: settings.clientId,
    };
    sessionStorage.setItem(pendingKey, JSON.stringify(pending));
    window.location.assign(current.request.url);
    return true;
  }
  const pending = current.request.promptAsync(current.discovery);
  prepared = null;
  void prepareLogin();
  const result = await pending;
  if (result.type === 'cancel' || result.type === 'dismiss') return false;
  if (result.type !== 'success' || !result.params.code || !current.request.codeVerifier) {
    throw new Error('connexion interrompue');
  }
  const token = await exchangeCodeAsync(
    {
      clientId: settings.clientId,
      code: result.params.code,
      redirectUri: current.request.redirectUri,
      extraParams: { code_verifier: current.request.codeVerifier },
    },
    current.discovery,
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
