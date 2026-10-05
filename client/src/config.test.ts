import assert from 'node:assert/strict';
import test from 'node:test';
import { authConfigured, config } from './config';

test('une adresse d’API vide reste sur le même site', () => {
  const previous = {
    api: process.env.EXPO_PUBLIC_API_URL,
    issuer: process.env.EXPO_PUBLIC_ISSUER_URL,
    client: process.env.EXPO_PUBLIC_CLIENT_ID,
  };
  process.env.EXPO_PUBLIC_API_URL = '';
  process.env.EXPO_PUBLIC_ISSUER_URL = 'https://issuer.example';
  process.env.EXPO_PUBLIC_CLIENT_ID = 'instacrane';
  try {
    assert.equal(config().apiUrl, '');
    assert.equal(authConfigured(), true);
  } finally {
    process.env.EXPO_PUBLIC_API_URL = previous.api;
    process.env.EXPO_PUBLIC_ISSUER_URL = previous.issuer;
    process.env.EXPO_PUBLIC_CLIENT_ID = previous.client;
  }
});
