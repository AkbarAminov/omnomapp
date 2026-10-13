import { supabase } from './supabase';
import { flush, track } from '../logic/analytics';

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

// users/app_sessions/user_events не пишут ни строки, если initAuth ни разу не проходит —
// и сам trackEvent() при этом молчит (нет профиля → no-op), так что без этой диагностики
// причина никогда не всплывёт. events (эта функция) не требует auth.uid(), пишет всегда.
async function authFailureReason(error: unknown): Promise<{ reason: string; status: number | null }> {
  if (!error) return { reason: 'no_tokens_in_response', status: null };
  const err = error as { context?: any; message?: string };
  const ctx = err.context;
  const status: number | null = ctx?.status ?? null;
  let reason = err.message ?? 'http_error';
  // .context не всегда настоящий Fetch Response в этой версии supabase-js (у него может не
  // быть .clone()) — читаем без clone и глотаем любую ошибку чтения, чтобы сама диагностика
  // никогда не маскировала причину провала своим же крашем.
  try {
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json();
      if (body?.error) reason = body.error;
    } else if (ctx && typeof ctx.text === 'function') {
      const text = await ctx.text();
      if (text) reason = text.slice(0, 200);
    }
  } catch {}
  return { reason, status };
}

async function authWithEdgeFunction(initData: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('auth-telegram', { body: { initData } });
  if (error || !data?.access_token || !data?.refresh_token) {
    const { reason, status } = await authFailureReason(error);
    track('auth_failed', { props: { step: 'edge_function', reason, status } });
    flush();
    return false;
  }
  const { error: sessionErr } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (sessionErr) {
    track('auth_failed', { props: { step: 'set_session', reason: sessionErr.message } });
    flush();
    return false;
  }
  cacheRefreshToken(data.refresh_token);
  return true;
}

async function authWithCachedToken(): Promise<boolean> {
  const cached = await getCachedRefreshToken();
  // Не трекаем: это ожидаемый путь при каждом провале authWithEdgeFunction, пока не
  // пройдёт хоть одна успешная авторизация — кэша ещё просто неоткуда взяться.
  if (!cached) return false;
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: cached });
  if (error || !data.session) {
    track('auth_failed', { props: { step: 'refresh_session', reason: error?.message ?? 'no_session' } });
    flush();
    return false;
  }
  cacheRefreshToken(data.session.refresh_token);
  return true;
}

// Best-effort, fire-and-forget from the caller's side: must never throw or block app
// startup. Outside Telegram (no initData) or on any failure the app simply keeps running
// without a profile — RLS-gated writes (events, sessions) are the only thing that skips.
export async function initAuth(): Promise<boolean> {
  try {
    const initData = getInitData();
    // Предыдущая диагностика молчала именно в этой ветке: без initData authWithEdgeFunction
    // не вызывается вообще, и до сих пор не было видно, это ли происходит в реальном Telegram.
    if (!initData) {
      track('auth_failed', { props: { step: 'no_init_data', platform: (window as any).Telegram?.WebApp?.platform ?? 'no_telegram_object' } });
      flush();
      return await authWithCachedToken();
    }
    if (await authWithEdgeFunction(initData)) return true;
    return await authWithCachedToken();
  } catch (e) {
    track('auth_failed', { props: { step: 'exception', reason: (e as Error)?.message ?? String(e) } });
    flush();
    console.warn('[OmNom] auth init failed:', e);
    return false;
  }
}
