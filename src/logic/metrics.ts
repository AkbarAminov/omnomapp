// New, auth-scoped telemetry (users/app_sessions/user_events — scripts/sql/008,009).
// Deliberately separate from analytics.ts/events: that pipeline stays as-is. Every insert
// here needs a real auth.uid() (see src/lib/auth.ts); with no profile, trackEvent is a no-op —
// matches the "outside Telegram / no signature → no profile, no analytics" rule.
import { supabase } from '../lib/supabase';
import { getAuthUserId } from '../lib/auth';
import { ALGORITHM_VERSION } from './engine';

const FLUSH_MS = 3000;
const MAX_QUEUE = 40;

const sessionId = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

type EventRow = {
  session_id: string;
  // null до того, как доехала авторизация: событие уже в очереди, а uid ему проставит flush.
  user_id: string | null;
  event_name: string;
  properties: Record<string, unknown>;
  app_version: string;
};

let queue: EventRow[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
// Открыта ли строка в app_sessions: user_events.session_id ссылается на неё внешним ключом,
// поэтому вставлять события до её создания нельзя — упадёт вся пачка.
let sessionOpen = false;
// Сколько раз flush уже ждал авторизацию. Вне Telegram профиля не будет никогда, и без
// этого счётчика таймер переспрашивал бы сессию до закрытия приложения.
let authWaits = 0;
const MAX_AUTH_WAITS = 12;

// Раньше здесь стояло `if (!uid) return` — событие, отправленное до того, как доехала
// авторизация, молча исчезало. Из-за этого onboarding_shown не записался ни разу (0 строк
// против 4 onboarding_completed): он срабатывает в useEffect на монтировании, когда
// getAuthUserId() ещё отдаёт null, а completed/skipped — секундами позже, когда сессия уже
// есть. Вход в воронку онбординга был не виден вообще. Теперь событие кладётся в очередь
// сразу, а uid ему проставляется при отправке.
export function trackEvent(eventName: string, properties: Record<string, unknown> = {}): void {
  queue.push({ session_id: sessionId, user_id: null, event_name: eventName, properties, app_version: ALGORITHM_VERSION });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  if (queue.length >= MAX_QUEUE) flush();
  else if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

// Fire-and-forget, with a retry: a failed batch goes back on the front of the queue so the
// next flush (timer or visibility change) picks it up. Never awaited by callers — metrics
// must not block or fail a swipe.
export function flush(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;
  void getAuthUserId().then((uid) => {
    // Нет профиля или ещё не открыта строка визита — очередь не теряем, а ждём. Вне
    // Telegram ждать нечего, поэтому после MAX_AUTH_WAITS попыток очередь просто
    // выбрасывается: правило «нет профиля → нет аналитики» сохраняется.
    if (!uid || !sessionOpen) {
      authWaits += 1;
      if (authWaits > MAX_AUTH_WAITS) {
        queue = [];
        return;
      }
      if (!timer) timer = setTimeout(flush, FLUSH_MS);
      return;
    }
    authWaits = 0;
    const rows = queue.map((r) => ({ ...r, user_id: uid }));
    queue = [];
    try {
      void supabase.from('user_events').insert(rows).then(({ error }) => {
        if (error) {
          console.warn('[OmNom] user_events insert failed:', error.message);
          queue = [...rows, ...queue].slice(-MAX_QUEUE);
        }
      });
    } catch (e) {
      console.warn('[OmNom] user_events insert exception:', e);
      queue = [...rows, ...queue].slice(-MAX_QUEUE);
    }
  });
}

// Called once at startup (src/main.tsx), after auth has had a chance to resolve. Opens the
// one app_sessions row for this visit and fires app_open. No-op without a profile.
export async function startAppSession(source: string | null, platform: string | null): Promise<void> {
  const uid = await getAuthUserId();
  if (!uid) return;
  try {
    const { error } = await supabase.from('app_sessions').insert({
      id: sessionId,
      user_id: uid,
      app_version: ALGORITHM_VERSION,
      platform,
      source,
    });
    // Снимаем замок только на успешной вставке: иначе события уйдут на session_id,
    // которого нет в app_sessions, и внешний ключ отклонит всю пачку.
    if (!error) sessionOpen = true;
    else console.warn('[OmNom] app_sessions insert failed:', error.message);
  } catch (e) {
    console.warn('[OmNom] app_sessions insert exception:', e);
  }
  trackEvent('app_open', { source });
  // События, накопленные до этого момента (например onboarding_shown), ждали именно его.
  flush();
}

export function getSessionId(): string {
  return sessionId;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}
