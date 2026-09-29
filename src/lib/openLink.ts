// Inside Telegram the WebApp API opens links in the in-app browser; elsewhere a new tab.
export function openExternalLink(url: string): void {
  const tg = window.Telegram?.WebApp;
  if (tg?.openLink) tg.openLink(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}
