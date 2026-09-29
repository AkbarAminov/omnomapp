export function getUserId(): string {
  return String((window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id ?? 'dev_user');
}

export function getTelegramUserInfo(): { name: string; username: string } {
  const u = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  return {
    name: u ? [u.first_name, u.last_name].filter(Boolean).join(' ') : '',
    username: u?.username ? `@${u.username}` : '',
  };
}
