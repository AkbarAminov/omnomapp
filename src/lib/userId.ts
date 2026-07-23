export function getUserId(): string {
  return String((window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id ?? 'dev_user');
}
