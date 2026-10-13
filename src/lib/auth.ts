import { supabase } from './supabase';

// Session refresh_token only — convenience cache so a flaky network on app_open doesn't
// force a profile-less run. Never cached to localStorage: outside Telegram there is no
// CloudStorage anyway, and outside-Telegram use is meant to stay profile-less (see initAuth).
const CLOUD_KEY = 'omnomRefreshToken';

function cloud(): any | null {
  const cs = (window as any).Telegram?.WebApp?.CloudStorage;
  return cs?.getItem && cs?.setItem ? cs : null;
}

function cacheRefreshToken(token: string): void {
  try { cloud()?.setItem(CLOUD_KEY, token, () => {}); } catch {}
}

function getCachedRefreshToken(): Promise<string | null> {
  const cs = cloud();
  if (!cs) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: string | null) => { if (!settled) { settled = true; resolve(v); } };
    setTimeout(() => done(null), 1200);
    try {
      cs.getItem(CLOUD_KEY, (err: unknown, value: string | undefined) => done(!err && value ? value : null));
    } catch { done(null); }
  });
}

function getInitData(): string | null {
  return (window as any).Telegram?.WebApp?.initData || null;
}

async function authWithEdgeFunction(initData: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('auth-telegram', { body: { initData } });
  if (error || !data?.access_token || !data?.refresh_token) return false;
  const { error: sessionErr } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (sessionErr) return false;
  cacheRefreshToken(data.refresh_token);
  return true;
}

async function authWithCachedToken(): Promise<boolean> {
  const cached = await getCachedRefreshToken();
  if (!cached) return false;
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: cached });
  if (error || !data.session) return false;
  cacheRefreshToken(data.session.refresh_token);
  return true;
}

// Best-effort, fire-and-forget from the caller's side: must never throw or block app
// startup. Outside Telegram (no initData) or on any failure the app simply keeps running
// without a profile — RLS-gated writes (events, sessions) are the only thing that skips.
export async function initAuth(): Promise<boolean> {
  try {
    const initData = getInitData();
    if (initData && (await authWithEdgeFunction(initData))) return true;
    return await authWithCachedToken();
  } catch (e) {
    console.warn('[OmNom] auth init failed:', e);
    return false;
  }
}
