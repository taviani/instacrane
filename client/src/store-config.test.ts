import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));

test('les identifiants de store restent ceux du produit', () => {
  const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
  assert.equal(app.scheme, 'instacrane');
  assert.equal(app.ios.bundleIdentifier, 'app.instacrane');
  assert.equal(app.android.package, 'app.instacrane');
  assert.equal(app.owner, undefined);
  assert.equal(app.extra?.eas?.projectId, undefined);
});

test('le profil de build ne contient pas de compte', () => {
  const text = readFileSync(new URL('../eas.json', import.meta.url), 'utf8');
  for (const key of ['appleTeamId', 'ascAppId', 'projectId', 'serviceAccount', 'owner']) {
    assert.equal(text.includes(key), false, key);
  }
});

test('le workflow téléphone est manuel et sans valeur de compte', () => {
  const text = readFileSync(new URL('../../.github/workflows/mobile.yml', import.meta.url), 'utf8');
  assert.match(text, /workflow_dispatch:/);
  assert.equal(text.includes('pull_request:'), false);
  assert.equal(/^\s*push:/m.test(text), false);
  assert.match(text, /submit_ios:/);
  assert.match(text, /submit_android:/);
  for (const name of [
    'EXPO_TOKEN',
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_ISSUER_URL',
    'EXPO_PUBLIC_CLIENT_ID',
    'EXPO_PROJECT_ID',
    'EXPO_OWNER',
    'EXPO_ASC_APP_ID',
  ]) {
    assert.equal(text.includes(name), true, name);
  }
  assert.equal(text.includes('https://'), false);
  assert.equal(text.includes('appleTeamId'), false);
  assert.equal(text.includes('serviceAccount'), false);
});

test('le déploiement copie les sources sans emporter l’environnement', () => {
  const text = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  for (const name of ['DEPLOY_SSH_KEY', 'DEPLOY_USER', 'DEPLOY_HOST', 'DEPLOY_PATH']) {
    assert.equal(text.includes(name), true, name);
  }
  assert.match(text, /refs\/heads\/main/);
  assert.match(text, /--exclude \.env/);
  assert.match(text, /docker-compose up -d --build/);
  assert.equal(text.includes('https://'), false);
});

test('la configuration chargée n’ajoute pas de compte', () => {
  const env = { ...process.env, EXPO_NO_TELEMETRY: '1', CI: '1' };
  delete env.EXPO_OWNER;
  delete env.EXPO_PROJECT_ID;
  const out = execFileSync('./node_modules/.bin/expo', ['config', '--json'], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
  const expo = JSON.parse(out.slice(out.indexOf('{')));
  const current = expo.expo ?? expo;
  assert.equal(current.scheme, 'instacrane');
  assert.equal(current.ios.bundleIdentifier, 'app.instacrane');
  assert.equal(current.android.package, 'app.instacrane');
  assert.equal(current.owner, undefined);
  assert.equal(current.extra?.eas?.projectId, undefined);
});
