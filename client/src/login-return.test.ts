import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import {
  exchangeAuthorizationCode,
  finishIssuerLogin,
  routeAfterSession,
  savePendingLogin,
  withoutAuthQuery,
  type LoginStore,
  type PendingLogin,
} from './login-return';

const pending: PendingLogin = {
  verifier: 'verifier-secret',
  state: 'state-secret',
  redirectUri: 'https://app.example/redirect',
  clientId: 'instacrane',
};

function memoryStore(): LoginStore & { dump(): string | null } {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
    dump: () => items.get('instacrane.login') ?? null,
  };
}

async function listenIssuer(): Promise<{ url: string; posts: string[]; close: () => Promise<void> }> {
  const posts: string[] = [];
  const server = createServer(async (request, response) => {
    const path = request.url?.split('?')[0] ?? '';
    if (request.method === 'GET' && path === '/.well-known/openid-configuration') {
      const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      sendJson(response, 200, {
        issuer: origin,
        authorization_endpoint: `${origin}/authorize`,
        token_endpoint: `${origin}/token`,
      });
      return;
    }
    if (request.method === 'POST' && path === '/token') {
      const body = await readBody(request);
      posts.push(body);
      const form = new URLSearchParams(body);
      if (form.get('code') === 'good-code' && form.get('code_verifier') === pending.verifier) {
        sendJson(response, 200, { access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600, token_type: 'Bearer' });
        return;
      }
      sendJson(response, 400, { error: 'invalid_grant', error_description: 'code refusé' });
      return;
    }
    sendJson(response, 404, { error: 'absent' });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  return {
    url: `http://127.0.0.1:${port}`,
    posts,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

test('le retour échange le code une fois auprès de l’issuer puis quitte /redirect', async () => {
  const issuer = await listenIssuer();
  try {
    const store = memoryStore();
    savePendingLogin(store, pending);
    const search = '?code=good-code&state=state-secret';
    const [first, second] = await Promise.all([
      finishIssuerLogin({ search, store, issuerUrl: issuer.url }),
      finishIssuerLogin({ search, store, issuerUrl: issuer.url }),
    ]);
    assert.equal(first.status, 'ok');
    assert.equal(second.status, 'ok');
    if (first.status === 'ok') assert.equal(first.token.accessToken, 'access-1');
    assert.equal(issuer.posts.length, 1);
    const form = new URLSearchParams(issuer.posts[0]);
    assert.equal(form.get('grant_type'), 'authorization_code');
    assert.equal(form.get('code'), 'good-code');
    assert.equal(form.get('code_verifier'), pending.verifier);
    assert.equal(form.get('client_id'), 'instacrane');
    assert.equal(form.get('redirect_uri'), pending.redirectUri);
    assert.equal(store.dump(), null);
    assert.equal(withoutAuthQuery('https://app.example/redirect?code=good-code&state=state-secret'), '/redirect');
    assert.equal(routeAfterSession('redirect', true, true), '/(tabs)/feed');
    assert.equal(routeAfterSession('redirect', true, false), '/username');
  } finally {
    await issuer.close();
  }
});

test('sans vérificateur, ou si l’issuer refuse, on revient à la connexion', async () => {
  const issuer = await listenIssuer();
  try {
    const missing = memoryStore();
    const lost = await finishIssuerLogin({
      search: '?code=good-code&state=state-secret',
      store: missing,
      issuerUrl: issuer.url,
    });
    assert.equal(lost.status, 'failed');
    if (lost.status === 'failed') assert.equal(lost.reason, 'connexion interrompue');
    assert.equal(issuer.posts.length, 0);
    assert.equal(routeAfterSession('redirect', false, false), '/login');

    const store = memoryStore();
    savePendingLogin(store, pending);
    const refused = await finishIssuerLogin({
      search: '?code=bad-code&state=state-secret',
      store,
      issuerUrl: issuer.url,
    });
    assert.equal(refused.status, 'failed');
    if (refused.status === 'failed') assert.equal(refused.reason, 'code refusé');
    assert.equal(issuer.posts.length, 1);
  } finally {
    await issuer.close();
  }
});

test('l’échange envoie le vérificateur à l’issuer découvert', async () => {
  const issuer = await listenIssuer();
  try {
    const token = await exchangeAuthorizationCode(pending, 'good-code', issuer.url);
    assert.equal(token.refreshToken, 'refresh-1');
    assert.equal(issuer.posts.length, 1);
  } finally {
    await issuer.close();
  }
});

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const raw = JSON.stringify(body);
  response.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw) });
  response.end(raw);
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}
