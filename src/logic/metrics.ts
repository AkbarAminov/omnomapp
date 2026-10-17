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
  user_id: string;
  event_name: string;
  properties: Record<string, unknown>;
  app_version: string;
};

let queue: EventRow[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function trackEvent(eventName: string, properties: Record<string, unknown> = {}): void {
  void getAuthUserId().then((uid) => {
    if (!uid) return;
    queue.push({ session_id: sessionId, user_id: uid, event_name: eventName, properties, app_version: ALGORITHM_VERSION });
    if (queue.length >= MAX_QUEUE) flush();
    else if (!timer) timer = setTimeout(flush, FLUSH_MS);
  });
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
  const rows = queue;
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
}

// Called once at startup (src/main.tsx), after auth has had a chance to resolve. Opens the
// one app_sessions row for this visit and fires app_open. No-op without a profile.
export async function startAppSession(source: string | null, platform: string | null): Promise<void> {
  const uid = await getAuthUserId();
  if (!uid) return;
  try {
    await supabase.from('app_sessions').insert({
      id: sessionId,
      user_id: uid,
      app_version: ALGORITHM_VERSION,
      platform,
      source,
    });
  } catch (e) {
    console.warn('[OmNom] app_sessions insert exception:', e);
  }
  trackEvent('app_open', { source });
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
