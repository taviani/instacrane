export type PendingLogin = {
  verifier: string;
  state: string;
  redirectUri: string;
  clientId: string;
};

export type LoginStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type TokenGrant = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
};

export type FinishResult = { status: 'none' } | { status: 'ok'; token: TokenGrant } | { status: 'failed'; reason: string };

const pendingKey = 'instacrane.login';

let flight: Promise<FinishResult> | null = null;
let flightKey = '';

export function savePendingLogin(store: LoginStore, pending: PendingLogin): void {
  store.setItem(pendingKey, JSON.stringify(pending));
}

export function routeAfterSession(top: string | undefined, hasToken: boolean, hasUsername: boolean): string | null {
  if (!hasToken) {
    if (top === 'login') return null;
    return '/login';
  }
  if (!hasUsername) {
    if (top === 'username') return null;
    return '/username';
  }
  if (!top || top === 'login' || top === 'username' || top === 'index' || top === 'redirect') return '/(tabs)/feed';
  return null;
}

export function withoutAuthQuery(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ''}${url.hash}`;
}

export async function exchangeAuthorizationCode(pending: PendingLogin, code: string, issuerUrl: string): Promise<TokenGrant> {
  const root = issuerUrl.replace(/\/$/, '');
  const discovery = await fetch(`${root}/.well-known/openid-configuration`);
  if (!discovery.ok) throw new Error('issuer indisponible');
  const doc = (await discovery.json()) as { token_endpoint?: string };
  if (!doc.token_endpoint) throw new Error('issuer indisponible');
  const response = await fetch(doc.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: pending.redirectUri,
      client_id: pending.clientId,
      code_verifier: pending.verifier,
    }),
  });
  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'connexion interrompue');
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
  };
}

export function finishIssuerLogin(input: { search: string; store: LoginStore; issuerUrl: string }): Promise<FinishResult> {
  const params = new URLSearchParams(input.search.startsWith('?') ? input.search.slice(1) : input.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  if (!code && !error) return Promise.resolve({ status: 'none' });
  const key = `${state ?? ''}\n${code ?? ''}\n${error ?? ''}`;
  if (flight && flightKey === key) return flight;
  flightKey = key;
  const run = runFinish(input, { code, state, error }).finally(() => {
    if (flight === run) {
      flight = null;
      flightKey = '';
    }
  });
  flight = run;
  return run;
}

async function runFinish(
  input: { search: string; store: LoginStore; issuerUrl: string },
  query: { code: string | null; state: string | null; error: string | null },
): Promise<FinishResult> {
  const raw = input.store.getItem(pendingKey);
  input.store.removeItem(pendingKey);
  if (query.error || !query.code) return { status: 'failed', reason: 'connexion interrompue' };
  let saved: PendingLogin;
  try {
    saved = JSON.parse(raw ?? '') as PendingLogin;
  } catch {
    return { status: 'failed', reason: 'connexion interrompue' };
  }
  if (!saved.verifier || query.state !== saved.state) return { status: 'failed', reason: 'connexion interrompue' };
  if (!input.issuerUrl) return { status: 'failed', reason: 'configuration locale absente' };
  try {
    const token = await exchangeAuthorizationCode(saved, query.code, input.issuerUrl);
    return { status: 'ok', token };
  } catch (cause) {
    return { status: 'failed', reason: cause instanceof Error ? cause.message : 'connexion interrompue' };
  }
}
