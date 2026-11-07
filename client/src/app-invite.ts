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

export function inviteDismissKey(id: string): string {
  return `instacrane.invite.${id}`;
}
