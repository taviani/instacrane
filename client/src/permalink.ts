import { routeAfterSession } from './login-return';

const postId = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function publicationPath(id: string): string | null {
  if (!postId.test(id)) return null;
  return `/publication/${id}`;
}

export function publicationPermalink(origin: string, id: string): string | null {
  const path = publicationPath(id);
  if (!path || !origin) return null;
  try {
    return new URL(path, origin.endsWith('/') ? origin : `${origin}/`).href;
  } catch {
    return null;
  }
}

/** Lien natif qui rouvre l’app, même forme que `instacrane://redirect`. */
export function publicationAppLink(id: string): string | null {
  const path = publicationPath(id);
  if (!path) return null;
  return `instacrane://${path.slice(1)}`;
}

export function publicationResume(path: string | null): string | null {
  if (!path) return null;
  const id = path.startsWith('/publication/') ? path.slice('/publication/'.length) : '';
  return publicationPath(id);
}

export function destinationAfterSession(
  top: string | undefined,
  hasToken: boolean,
  hasUsername: boolean,
  pathname: string,
  saved: string | null,
): { go: string | null; save: string | null; clear: boolean } {
  const next = routeAfterSession(top, hasToken, hasUsername);
  const current = publicationResume(pathname);
  if (!hasToken || !hasUsername) return { go: next, save: current, clear: false };
  if (next === '/(tabs)/feed') {
    return { go: publicationResume(saved) ?? next, save: null, clear: true };
  }
  return { go: next, save: null, clear: true };
}
