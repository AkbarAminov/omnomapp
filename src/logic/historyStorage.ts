export type HistoryItem = {
  id: string;
  name: string;
  name_uz?: string;
  image: string;       // filename only, e.g. "plov.jpg"
  emoji: string;
  matchPercent: number;
  date: string;        // "DD.MM.YY"
};

const KEY = 'omnom_history';
const MAX_ITEMS = 50;

export function saveHistory(history: HistoryItem[]): void {
  const payload = JSON.stringify(history.slice(0, MAX_ITEMS));
  try {
    window.Telegram?.WebApp?.CloudStorage?.setItem(KEY, payload);
  } catch {}
}

export function loadHistory(onLoad: (items: HistoryItem[]) => void): void {
  const cs = window.Telegram?.WebApp?.CloudStorage;
  if (!cs) {
    onLoad([]);
    return;
  }
  try {
    cs.getItem(KEY, (_err: unknown, value: string | undefined) => {
      if (!value) { onLoad([]); return; }
      try { onLoad(JSON.parse(value) as HistoryItem[]); }
      catch { onLoad([]); }
    });
  } catch {
    onLoad([]);
  }
}
