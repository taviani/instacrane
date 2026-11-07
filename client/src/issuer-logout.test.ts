import assert from 'node:assert/strict';
import test from 'node:test';
import { issuerLogoutURL } from './issuer-logout';

test('la déconnexion vise l’issuer et le retour déjà connu', () => {
  assert.equal(
    issuerLogoutURL('https://issuer.example', 'instacrane', 'https://app.example/redirect'),
    'https://issuer.example/logout?client_id=instacrane&redirect_uri=https%3A%2F%2Fapp.example%2Fredirect',
  );
  assert.equal(
    issuerLogoutURL('https://issuer.example/', 'instacrane', 'instacrane://redirect'),
    'https://issuer.example/logout?client_id=instacrane&redirect_uri=instacrane%3A%2F%2Fredirect',
  );
  assert.equal(issuerLogoutURL('', 'instacrane', 'https://app.example/redirect'), null);
  assert.equal(issuerLogoutURL('https://issuer.example', '', 'https://app.example/redirect'), null);
});
