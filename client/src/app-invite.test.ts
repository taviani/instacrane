import assert from 'node:assert/strict';
import test from 'node:test';
import { inviteDismissKey, isMobileBrowser, storeUrlFor } from './app-invite';

test('un navigateur de téléphone est reconnu', () => {
  assert.equal(isMobileBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), true);
  assert.equal(isMobileBrowser('Mozilla/5.0 (Linux; Android 14)'), true);
  assert.equal(isMobileBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)'), false);
});

test('le store suit le système du navigateur', () => {
  assert.equal(
    storeUrlFor('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', {
      ios: 'https://apps.example/ios',
      android: 'https://play.example/android',
    }),
    'https://apps.example/ios',
  );
  assert.equal(
    storeUrlFor('Mozilla/5.0 (Linux; Android 14)', {
      ios: 'https://apps.example/ios',
      android: 'https://play.example/android',
    }),
    'https://play.example/android',
  );
  assert.equal(storeUrlFor('Mozilla/5.0 (iPhone)', { ios: '', android: 'https://play.example/android' }), null);
});

test('la clé d’oubli de la proposition est stable', () => {
  assert.equal(inviteDismissKey('abc'), 'instacrane.invite.abc');
});
