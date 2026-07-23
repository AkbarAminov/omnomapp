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

// Callback-based wrappers for components that load settings on mount
export function loadDiet(onLoad: (items: string[]) => void): void {
  loadSettings().then(({ allergens }) => onLoad(allergens)).catch(() => onLoad([]));
}

export function loadLanguage(onLoad: (lang: string) => void): void {
  loadSettings().then(({ lang }) => onLoad(lang)).catch(() => onLoad('ru'));
}
