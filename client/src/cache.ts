import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

const memory = new Map<string, string>();

export function photoKey(id: string, position: number): string {
  return safe(`photo-${id}-${position}`);
}

export function thumbKey(id: string): string {
  return safe(`thumb-${id}`);
}

export function avatarKey(username: string, url: string | null | undefined): string {
  return safe(`avatar-${username}-${pathOf(url)}`);
}

export async function dropPost(id: string): Promise<void> {
  const names = [thumbKey(id)];
  for (let position = 1; position <= 20; position += 1) names.push(photoKey(id, position));
  await Promise.all(names.map((name) => dropKey(name)));
}

export async function cachedUri(name: string): Promise<string | null> {
  const key = safe(name);
  const remembered = memory.get(key);
  if (remembered) return remembered;
  if (Platform.OS === 'web') return webRead(key);
  const file = cacheFile(key);
  return file.exists ? file.uri : null;
}

export async function storeImage(name: string, url: string): Promise<string> {
  const key = safe(name);
  const existing = await cachedUri(key);
  if (existing) return existing;
  if (Platform.OS === 'web') return webStore(key, url);
  const directory = new Directory(Paths.cache, 'instacrane');
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  const file = cacheFile(key);
  try {
    await File.downloadFileAsync(url, file, { idempotent: true });
  } catch (error) {
    if (file.exists) file.delete();
    throw error;
  }
  return file.uri;
}

export async function dropKey(name: string): Promise<void> {
  const key = safe(name);
  const remembered = memory.get(key);
  if (remembered?.startsWith('blob:')) URL.revokeObjectURL(remembered);
  memory.delete(key);
  if (Platform.OS === 'web') {
    if ('caches' in globalThis) {
      const cache = await caches.open('instacrane');
      await cache.delete(cacheRequest(key));
    }
    return;
  }
  const file = cacheFile(key);
  if (file.exists) file.delete();
}

async function webRead(key: string): Promise<string | null> {
  if (!('caches' in globalThis)) return null;
  const cache = await caches.open('instacrane');
  const hit = await cache.match(cacheRequest(key));
  if (!hit) return null;
  const url = URL.createObjectURL(await hit.blob());
  memory.set(key, url);
  return url;
}

async function webStore(key: string, url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status));
  const blob = await response.blob();
  if ('caches' in globalThis) {
    const cache = await caches.open('instacrane');
    await cache.put(cacheRequest(key), new Response(blob.slice(), { headers: { 'Content-Type': blob.type || 'image/jpeg' } }));
  }
  const objectUrl = URL.createObjectURL(blob);
  memory.set(key, objectUrl);
  return objectUrl;
}

function cacheFile(name: string): File {
  return new File(Paths.cache, 'instacrane', `${name}.jpg`);
}

function cacheRequest(name: string): Request {
  return new Request(`https://instacrane.cache/${encodeURIComponent(name)}`);
}

function pathOf(url: string | null | undefined): string {
  if (!url) return 'none';
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function safe(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 180);
}
