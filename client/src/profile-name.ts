export function profileTitle(username: string, displayName: string | null | undefined): string {
  const display = shownDisplay(username, displayName);
  return display ?? username;
}

export function profileDisplayLine(username: string, displayName: string | null | undefined): string | null {
  const display = displayName?.trim() ?? '';
  if (!display || sameName(username, display)) return null;
  return display;
}

function shownDisplay(username: string, displayName: string | null | undefined): string | null {
  const display = displayName?.trim() ?? '';
  if (display && sameName(username, display)) return display;
  return null;
}

function sameName(username: string, display: string): boolean {
  return display.localeCompare(username, 'fr', { sensitivity: 'accent' }) === 0;
}
