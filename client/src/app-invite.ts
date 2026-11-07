import { publicationAppLink, publicationResume } from './permalink';

export function isMobileBrowser(ua: string): boolean {
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

export function storeUrlFor(
  ua: string,
  urls: { ios: string; android: string },
): string | null {
  if (/iPhone|iPad|iPod/i.test(ua)) return urls.ios || null;
  if (/Android/i.test(ua)) return urls.android || null;
  return null;
}

/** Lien natif pour la page courante du site. */
export function appLinkForPath(pathname: string): string | null {
  const publication = publicationResume(pathname);
  if (publication) {
    const id = publication.slice('/publication/'.length);
    return publicationAppLink(id);
  }
  const path = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  if (!path || path === 'index') return 'instacrane://';
  return `instacrane://${path}`;
}
