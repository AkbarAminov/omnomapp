import { supabase } from '../lib/supabase';
import { getAuthUserId } from '../lib/auth';

type Settings = { lang: string; allergens: string[] };

let settingsPromise: Promise<Settings> | null = null;

// RLS on user_settings checks auth.uid(): without a real session there is no user_id a
// read/write could legally use, so this falls back to defaults rather than a client-trusted id.
async function fetchSettings(): Promise<Settings> {
  const userId = await getAuthUserId();
  if (!userId) return { lang: 'ru', allergens: [] };
  try {
    const { data } = await supabase
      .from('user_settings')
      .select('lang, allergens')
      .eq('user_id', userId)
      .maybeSingle();
    return { lang: data?.lang ?? 'ru', allergens: (data?.allergens as string[]) ?? [] };
  } catch {
    return { lang: 'ru', allergens: [] };
  }
}

export function loadSettings(): Promise<Settings> {
  if (!settingsPromise) settingsPromise = fetchSettings();
  return settingsPromise;
}

// Возвращает, доехала ли запись: раньше ошибка глушилась пустым catch, и по пустой таблице
// user_settings нельзя было понять — никто не сохранял настройки или запись молча падала.
export async function saveSettings(lang: string, allergens: string[]): Promise<boolean> {
  settingsPromise = Promise.resolve({ lang, allergens });
  const userId = await getAuthUserId();
  if (!userId) return false;
  try {
    const { error } = await supabase.from('user_settings').upsert(
      { user_id: userId, lang, allergens, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
    if (error) {
      console.warn('[OmNom] user_settings upsert failed:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[OmNom] user_settings upsert exception:', e);
    return false;
  }
}

// Туториалы (общий по приложению + «Или / Или») показываются один раз каждый. Храним флаг
// в CloudStorage Telegram — он переживает очистку вебвью и переезд на другое устройство;
// localStorage остаётся запасным вариантом для браузера и старых клиентов.
const BATTLE_ONBOARDING_KEY = 'foodBattleOnboardingSeen';
const APP_ONBOARDING_KEY = 'appOnboardingSeen';

function cloud(): any | null {
  const cs = (window as any).Telegram?.WebApp?.CloudStorage;
  return cs?.getItem && cs?.setItem ? cs : null;
}

function isFlagSeen(key: string): Promise<boolean> {
  try { if (localStorage.getItem(key) === 'true') return Promise.resolve(true); } catch {}
  const cs = cloud();
  if (!cs) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: boolean) => { if (!settled) { settled = true; resolve(v); } };
    // Сеть может не ответить — подсказку лучше показать лишний раз, чем подвесить экран.
    setTimeout(() => done(false), 1200);
    try {
      cs.getItem(key, (err: unknown, value: string) => done(!err && value === 'true'));
    } catch { done(false); }
  });
}

function markFlagSeen(key: string): void {
  try { localStorage.setItem(key, 'true'); } catch {}
  try { cloud()?.setItem(key, 'true', () => {}); } catch {}
}

export const isBattleOnboardingSeen = () => isFlagSeen(BATTLE_ONBOARDING_KEY);
export const markBattleOnboardingSeen = () => markFlagSeen(BATTLE_ONBOARDING_KEY);
export const isAppOnboardingSeen = () => isFlagSeen(APP_ONBOARDING_KEY);
export const markAppOnboardingSeen = () => markFlagSeen(APP_ONBOARDING_KEY);

// Callback-based wrappers for components that load settings on mount
export function loadDiet(onLoad: (items: string[]) => void): void {
  loadSettings().then(({ allergens }) => onLoad(allergens)).catch(() => onLoad([]));
}

export function loadLanguage(onLoad: (lang: string) => void): void {
  loadSettings().then(({ lang }) => onLoad(lang)).catch(() => onLoad('ru'));
}
