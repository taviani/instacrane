import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Directory, File, Paths } from 'expo-file-system';

const sessionKey = 'instacrane.session';
const alertsKey = 'instacrane.alerts';

export type StoredSession = {
  accessToken: string;
  refreshToken?: string;
  issuedAt: number;
  expiresIn?: number;
};

let memory: StoredSession | null | undefined;
const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emit(): void {
  for (const listener of listeners) listener();
}

export async function hydrate(): Promise<StoredSession | null> {
  const current = memory;
  if (current !== undefined) return current;
  const loaded = await readValue(sessionKey).then(parseSession);
  memory = loaded;
  return loaded;
}

export async function readSession(): Promise<StoredSession | null> {
  const current = memory;
  if (current === undefined) return hydrate();
  return current;
}

export async function writeSession(session: StoredSession): Promise<void> {
  memory = session;
  await writeValue(sessionKey, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  memory = null;
  await deleteValue(sessionKey);
}

export async function alertsAccepted(): Promise<boolean> {
  return (await readValue(alertsKey)) === '1';
}

export async function setAlertsAccepted(accepted: boolean): Promise<void> {
  if (accepted) await writeValue(alertsKey, '1');
  else await deleteValue(alertsKey);
}

function parseSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed || typeof parsed.accessToken !== 'string' || !parsed.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readValue(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  try {
    if (await SecureStore.isAvailableAsync()) {
      const stored = await SecureStore.getItemAsync(key);
      if (stored) return stored;
    }
  } catch {
    // The file copy below is the fallback.
  }
  const file = valueFile(key);
  if (!file.exists) return null;
  return file.text();
}

async function writeValue(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  try {
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.setItemAsync(key, value);
      const file = valueFile(key);
      if (file.exists) file.delete();
      return;
    }
  } catch {
    await SecureStore.deleteItemAsync(key).catch(() => undefined);
  }
  const directory = new Directory(Paths.document);
  if (!directory.exists) directory.create({ idempotent: true });
  const file = valueFile(key);
  if (!file.exists) file.create();
  file.write(value);
}

async function deleteValue(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key).catch(() => undefined);
  const file = valueFile(key);
  if (file.exists) file.delete();
}

function valueFile(key: string): File {
  return new File(Paths.document, `${key}.json`);
}
