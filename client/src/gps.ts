import type { Coords } from './types';

export function fromExif(exif: Record<string, unknown> | null | undefined): Coords | null {
  if (!exif) return null;
  const latitude = component(exif.GPSLatitude ?? exif.latitude, exif.GPSLatitudeRef ?? exif.latitudeRef);
  const longitude = component(exif.GPSLongitude ?? exif.longitude, exif.GPSLongitudeRef ?? exif.longitudeRef);
  return pair(latitude, longitude);
}

export function readJpegGps(bytes: Uint8Array): Coords | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) return null;
    const size = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (size < 2 || offset + 2 + size > bytes.length) return null;
    if (marker === 0xe1) {
      const found = exifGps(bytes.subarray(offset + 4, offset + 2 + size));
      if (found) return found;
    }
    offset += 2 + size;
  }
  return null;
}

function exifGps(segment: Uint8Array): Coords | null {
  const header = [0x45, 0x78, 0x69, 0x66, 0, 0];
  if (segment.length < header.length + 8) return null;
  for (let i = 0; i < header.length; i += 1) {
    if (segment[i] !== header[i]) return null;
  }
  return tiffGps(segment.subarray(header.length));
}

function tiffGps(tiff: Uint8Array): Coords | null {
  if (tiff.length < 8) return null;
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  const big = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!little && !big) return null;
  const u16 = (at: number) => {
    if (at + 1 >= tiff.length) return 0;
    return little ? tiff[at] | (tiff[at + 1] << 8) : (tiff[at] << 8) | tiff[at + 1];
  };
  const u32 = (at: number) => {
    if (at + 3 >= tiff.length) return 0;
    return little
      ? (tiff[at] | (tiff[at + 1] << 8) | (tiff[at + 2] << 16) | (tiff[at + 3] << 24)) >>> 0
      : ((tiff[at] << 24) | (tiff[at + 1] << 16) | (tiff[at + 2] << 8) | tiff[at + 3]) >>> 0;
  };
  if (u16(2) !== 42) return null;
  const gps = pointer(tiff, u32(4), 0x8825, u16, u32);
  if (gps == null) return null;
  const latitude = signed(rational(tiff, gps, 2, u16, u32), ascii(tiff, gps, 1, u16, u32));
  const longitude = signed(rational(tiff, gps, 4, u16, u32), ascii(tiff, gps, 3, u16, u32));
  return pair(latitude, longitude);
}

function pointer(
  tiff: Uint8Array,
  ifd: number,
  tag: number,
  u16: (at: number) => number,
  u32: (at: number) => number,
): number | null {
  if (ifd + 2 > tiff.length) return null;
  const count = u16(ifd);
  for (let i = 0; i < count; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > tiff.length) return null;
    if (u16(entry) === tag && u16(entry + 2) === 4) return u32(entry + 8);
  }
  return null;
}

function entryAt(
  tiff: Uint8Array,
  ifd: number,
  tag: number,
  u16: (at: number) => number,
): number | null {
  if (ifd + 2 > tiff.length) return null;
  const count = u16(ifd);
  for (let i = 0; i < count; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > tiff.length) return null;
    if (u16(entry) === tag) return entry;
  }
  return null;
}

function rational(
  tiff: Uint8Array,
  ifd: number,
  tag: number,
  u16: (at: number) => number,
  u32: (at: number) => number,
): number | null {
  const entry = entryAt(tiff, ifd, tag, u16);
  if (entry == null || u16(entry + 2) !== 5) return null;
  const count = Math.min(u32(entry + 4), 3);
  if (count < 1) return null;
  const bytes = count * 8;
  const offset = bytes <= 4 ? entry + 8 : u32(entry + 8);
  let value = 0;
  let place = 1;
  for (let i = 0; i < count; i += 1) {
    const den = u32(offset + i * 8 + 4);
    if (!den) return null;
    value += u32(offset + i * 8) / den / place;
    place *= 60;
  }
  return value;
}

function ascii(
  tiff: Uint8Array,
  ifd: number,
  tag: number,
  u16: (at: number) => number,
  u32: (at: number) => number,
): string {
  const entry = entryAt(tiff, ifd, tag, u16);
  if (entry == null || u16(entry + 2) !== 2) return '';
  const count = u32(entry + 4);
  const offset = count <= 4 ? entry + 8 : u32(entry + 8);
  let text = '';
  for (let i = 0; i < count && offset + i < tiff.length; i += 1) {
    const code = tiff[offset + i];
    if (code === 0) break;
    text += String.fromCharCode(code);
  }
  return text;
}

function component(value: unknown, ref: unknown): number | null {
  let number: number | null = null;
  if (typeof value === 'number' && Number.isFinite(value)) number = value;
  else if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) number = Number(value);
  else if (Array.isArray(value)) {
    const parts = value.slice(0, 3).map((part) => (typeof part === 'number' ? part : Number(part)));
    if (parts.length === 0 || parts.some((part) => !Number.isFinite(part))) return null;
    number = (parts[0] ?? 0) + (parts[1] ?? 0) / 60 + (parts[2] ?? 0) / 3600;
  }
  if (number == null) return null;
  const side = typeof ref === 'string' ? ref.toUpperCase() : '';
  if (side === 'S' || side === 'W') return -Math.abs(number);
  if (side === 'N' || side === 'E') return Math.abs(number);
  return number;
}

function signed(value: number | null, ref: string): number | null {
  if (value == null) return null;
  return component(value, ref);
}

function pair(latitude: number | null, longitude: number | null): Coords | null {
  if (latitude == null || longitude == null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}
