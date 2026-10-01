import { supabase } from '../lib/supabase';
import { getUserId } from '../lib/userId';

type Settings = { lang: string; allergens: string[] };

let settingsPromise: Promise<Settings> | null = null;

async function fetchSettings(): Promise<Settings> {
  try {
    const { data } = await supabase
      .from('user_settings')
      .select('lang, allergens')
      .eq('user_id', getUserId())
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

export async function saveSettings(lang: string, allergens: string[]): Promise<void> {
  settingsPromise = Promise.resolve({ lang, allergens });
  try {
    await supabase.from('user_settings').upsert(
      { user_id: getUserId(), lang, allergens, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  } catch {}
}

// Туториал «Или / Или» показывается один раз. Храним флаг в CloudStorage Telegram —
// он переживает очистку вебвью и переезд на другое устройство; localStorage остаётся
// запасным вариантом для браузера и старых клиентов.
const BATTLE_ONBOARDING_KEY = 'foodBattleOnboardingSeen';

function cloud(): any | null {
  const cs = (window as any).Telegram?.WebApp?.CloudStorage;
  return cs?.getItem && cs?.setItem ? cs : null;
}

function localFlag(): boolean {
  try { return localStorage.getItem(BATTLE_ONBOARDING_KEY) === 'true'; } catch { return false; }
}

export function isBattleOnboardingSeen(): Promise<boolean> {
  if (localFlag()) return Promise.resolve(true);
  const cs = cloud();
  if (!cs) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: boolean) => { if (!settled) { settled = true; resolve(v); } };
    // Сеть может не ответить — подсказку лучше показать лишний раз, чем подвесить экран.
    setTimeout(() => done(false), 1200);
    try {
      cs.getItem(BATTLE_ONBOARDING_KEY, (err: unknown, value: string) => done(!err && value === 'true'));
    } catch { done(false); }
  });
}

export function markBattleOnboardingSeen(): void {
  try { localStorage.setItem(BATTLE_ONBOARDING_KEY, 'true'); } catch {}
  try { cloud()?.setItem(BATTLE_ONBOARDING_KEY, 'true', () => {}); } catch {}
}

// Callback-based wrappers for components that load settings on mount
export function loadDiet(onLoad: (items: string[]) => void): void {
  loadSettings().then(({ allergens }) => onLoad(allergens)).catch(() => onLoad([]));
}

export function loadLanguage(onLoad: (lang: string) => void): void {
  loadSettings().then(({ lang }) => onLoad(lang)).catch(() => onLoad('ru'));
}
