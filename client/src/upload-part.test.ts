import assert from 'node:assert/strict';
import test from 'node:test';
import { photoPart } from './upload-part';

test('la photo part en octets, pas en adresse locale', async () => {
  const part = photoPart(new Uint8Array([1, 2, 3]));
  assert.equal(part.name, 'photo.jpg');
  assert.equal(part.type, 'image/jpeg');
  assert.equal('uri' in part, false);
  assert.deepEqual(await part.bytes(), new Uint8Array([1, 2, 3]));
});
