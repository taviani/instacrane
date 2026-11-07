export function issuerLogoutURL(issuer: string, clientId: string, redirectUri: string): string | null {
  const root = issuer.trim().replace(/\/$/, '');
  const id = clientId.trim();
  const back = redirectUri.trim();
  if (!root || !id || !back) return null;
  try {
    const url = new URL('/logout', `${root}/`);
    url.searchParams.set('client_id', id);
    url.searchParams.set('redirect_uri', back);
    return url.href;
  } catch {
    return null;
  }
}
