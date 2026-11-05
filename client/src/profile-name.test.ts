import assert from 'node:assert/strict';
import test from 'node:test';
import { profileDisplayLine, profileTitle } from './profile-name';

test('le profil reprend la casse du nom affiché', () => {
  assert.equal(profileTitle('ed', 'Ed'), 'Ed');
  assert.equal(profileDisplayLine('ed', 'Ed'), null);
});

test('un nom affiché différent reste en dessous', () => {
  assert.equal(profileTitle('ed', 'Edouard'), 'ed');
  assert.equal(profileDisplayLine('ed', 'Edouard'), 'Edouard');
});

test('sans nom affiché, le nom d’utilisateur reste', () => {
  assert.equal(profileTitle('ed', ''), 'ed');
  assert.equal(profileDisplayLine('ed', null), null);
});
