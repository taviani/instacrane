import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { ApiError, api } from './api';
import { login as beginLogin, refreshSession } from './auth';
import type { Note, Owner } from './types';
import { clearSession, emit, hydrate, readSession, setAlertsAccepted, subscribe } from './vault';

type SessionValue = {
  ready: boolean;
  token: string | null;
  me: Owner | null;
  offline: boolean;
  bell: boolean;
  login: () => Promise<boolean>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  setMe: (owner: Owner) => void;
  reloadBell: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Owner | null>(null);
  const [offline, setOffline] = useState(false);
  const [bell, setBell] = useState(false);

  async function refreshMe(): Promise<void> {
    const session = await readSession();
    setToken(session?.accessToken ?? null);
    if (!session?.accessToken) {
      setMe(null);
      setOffline(false);
      setBell(false);
      return;
    }
    try {
      const owner = await api<Owner>('/api/users/me');
      setMe(owner);
      setOffline(false);
      if (owner.username) await reloadBell();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setMe(null);
        setToken(null);
        setOffline(false);
        return;
      }
      setOffline(true);
    }
  }

  async function reloadBell(): Promise<void> {
    try {
      const page = await api<{ bell: boolean; notifications: Note[] }>('/api/notifications?limit=1');
      setBell(page.bell);
    } catch {
      // The bell stays as it was when the list cannot be loaded.
    }
  }

  useEffect(() => {
    const stop = subscribe(() => {
      void refreshMe();
    });
    void (async () => {
      await hydrate();
      await refreshSession();
      await refreshMe();
      setReady(true);
    })();
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshSession().then(() => refreshMe());
      }
    });
    return () => {
      stop();
      app.remove();
    };
  }, []);

  async function login(): Promise<boolean> {
    const started = await beginLogin();
    if (started) await refreshMe();
    return started;
  }

  async function logout(): Promise<void> {
    try {
      await api('/api/users/me/alert-token', { method: 'DELETE' });
    } catch {
      // The local session still goes away.
    }
    await setAlertsAccepted(false);
    await clearSession();
    emit();
  }

  return (
    <SessionContext.Provider value={{ ready, token, me, offline, bell, login, logout, refreshMe, setMe, reloadBell }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('session absente');
  return value;
}
