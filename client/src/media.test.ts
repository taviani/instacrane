import assert from 'node:assert/strict';
import test from 'node:test';
import { avatarActions, portraitActions } from './crop';
import { fromExif, readJpegGps } from './gps';

test('portrait crop keeps 4:5 and caps the long edge', () => {
  const wide = portraitActions(2000, 2000);
  assert.deepEqual(wide[0], { crop: { originX: 200, originY: 0, width: 1600, height: 2000 } });
  assert.deepEqual(wide[1], { resize: { width: 1152, height: 1440 } });

  const exact = portraitActions(800, 1000);
  assert.deepEqual(exact, [{ crop: { originX: 0, originY: 0, width: 800, height: 1000 } }]);

  const tall = portraitActions(400, 1000);
  assert.deepEqual(tall, [{ crop: { originX: 0, originY: 250, width: 400, height: 500 } }]);
});

test('avatar fit keeps the ratio under 512', () => {
  assert.deepEqual(avatarActions(2000, 1000), [{ resize: { width: 512 } }]);
  assert.deepEqual(avatarActions(1000, 2000), [{ resize: { height: 512 } }]);
  assert.deepEqual(avatarActions(400, 400), []);
});

test('exif objects become one coordinate pair', () => {
  assert.deepEqual(fromExif({ GPSLatitude: [48, 30, 0], GPSLatitudeRef: 'N', GPSLongitude: [2, 20, 0], GPSLongitudeRef: 'E' }), {
    latitude: 48.5,
    longitude: 2 + 20 / 60,
  });
  assert.equal(fromExif({ GPSLatitude: 1 }), null);
});

test('jpeg exif gps is read before the file is re-encoded', () => {
  const found = readJpegGps(sampleJpeg(48, 30, 0, 'N', 2, 20, 0, 'W'));
  assert.ok(found);
  assert.equal(found.latitude, 48.5);
  assert.ok(Math.abs(found.longitude - -(2 + 20 / 60)) < 1e-9);
});

function sampleJpeg(
  latD: number,
  latM: number,
  latS: number,
  latRef: string,
  lonD: number,
  lonM: number,
  lonS: number,
  lonRef: string,
): Uint8Array {
  const tiff = new Uint8Array(128);
  const view = new DataView(tiff.buffer);
  tiff[0] = 0x49;
  tiff[1] = 0x49;
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  view.setUint16(8, 1, true);
  view.setUint16(10, 0x8825, true);
  view.setUint16(12, 4, true);
  view.setUint32(14, 1, true);
  view.setUint32(18, 26, true);
  view.setUint16(26, 4, true);
  writeEntry(view, 28, 1, 2, 2, textValue(latRef));
  writeEntry(view, 40, 2, 5, 3, 80);
  writeEntry(view, 52, 3, 2, 2, textValue(lonRef));
  writeEntry(view, 64, 4, 5, 3, 104);
  writeRational(view, 80, latD, latM, latS);
  writeRational(view, 104, lonD, lonM, lonS);
  const payload = new Uint8Array(6 + tiff.length);
  payload.set([0x45, 0x78, 0x69, 0x66, 0, 0]);
  payload.set(tiff, 6);
  const bytes = new Uint8Array(2 + 2 + 2 + payload.length);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xe1;
  bytes[4] = (payload.length + 2) >> 8;
  bytes[5] = (payload.length + 2) & 0xff;
  bytes.set(payload, 6);
  return bytes;
}

function writeEntry(view: DataView, offset: number, tag: number, type: number, count: number, value: number) {
  view.setUint16(offset, tag, true);
  view.setUint16(offset + 2, type, true);
  view.setUint32(offset + 4, count, true);
  view.setUint32(offset + 8, value, true);
}

function writeRational(view: DataView, offset: number, degrees: number, minutes: number, seconds: number) {
  view.setUint32(offset, degrees, true);
  view.setUint32(offset + 4, 1, true);
  view.setUint32(offset + 8, minutes, true);
  view.setUint32(offset + 12, 1, true);
  view.setUint32(offset + 16, seconds, true);
  view.setUint32(offset + 20, 1, true);
}

function textValue(ref: string): number {
  return ref.charCodeAt(0);
}
