import assert from 'node:assert/strict';
import test from 'node:test';
import { ago } from './text';

const now = Date.parse('2026-11-04T12:00:00Z');

test('durée relative', () => {
  assert.equal(ago('2026-11-04T11:59:40Z', now), 'à l’instant');
  assert.equal(ago('2026-11-04T11:34:00Z', now), 'il y a 26 minutes');
  assert.equal(ago('2026-11-01T12:00:00Z', now), 'il y a 3 jours');
  assert.equal(ago('2026-10-28T12:00:00Z', now), 'il y a une semaine');
});
