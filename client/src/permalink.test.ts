import assert from 'node:assert/strict';
import test from 'node:test';
import { destinationAfterSession, publicationPath, publicationPermalink, publicationResume } from './permalink';

const id = '11111111-1111-4111-8111-111111111111';
const path = `/publication/${id}`;

test('le lien d’une publication est son adresse', () => {
  assert.equal(publicationPath(id), path);
  assert.equal(publicationPath('pas-un-id'), null);
  assert.equal(publicationPermalink('https://example.com', id), `https://example.com${path}`);
  assert.equal(publicationPermalink('https://example.com/', id), `https://example.com${path}`);
  assert.equal(publicationPermalink('instacrane://', id), `instacrane://${path}`);
  assert.equal(publicationResume(path), path);
  assert.equal(publicationResume('/publication/non'), null);
});

test('sans session, le lien revient à cette publication après la connexion', () => {
  assert.deepEqual(destinationAfterSession('publication', false, false, path, null), {
    go: '/login',
    save: path,
    clear: false,
  });
  assert.deepEqual(destinationAfterSession('login', false, false, '/login', path), {
    go: null,
    save: null,
    clear: false,
  });
  assert.deepEqual(destinationAfterSession('publication', true, false, path, null), {
    go: '/username',
    save: path,
    clear: false,
  });
  assert.deepEqual(destinationAfterSession('redirect', true, true, '/redirect', path), {
    go: path,
    save: null,
    clear: true,
  });
  assert.deepEqual(destinationAfterSession('redirect', true, true, '/redirect', '/publication/non'), {
    go: '/(tabs)/feed',
    save: null,
    clear: true,
  });
  assert.deepEqual(destinationAfterSession('(tabs)', true, true, '/feed', path), {
    go: null,
    save: null,
    clear: true,
  });
});
