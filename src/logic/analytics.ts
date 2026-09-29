import { supabase } from '../lib/supabase';
import { getUserId } from '../lib/userId';
import { ALGORITHM_VERSION } from './engine';

// «Неважно» is not its own event: it is question_answered with answer = 'any'.
export type EventName =
  | 'test_started'
  | 'question_shown'
  | 'question_answered'
  | 'test_completed'
  | 'results_shown'
  | 'all_variants_opened'
  | 'other_cuisine_opened'
  | 'recommendation_rejected'
  | 'test_abandoned'
  | 'random_selected';

export type EventFields = {
  session_id?: string | null;
  mode?: string | null;
  cuisine?: string | null;
  dish_id?: string | null;
  question_id?: string | null;
  answer?: string | null;
  question_index?: number | null;
  props?: Record<string, unknown>;
};

type EventRow = EventFields & {
  event: EventName;
  user_id: string;
  algorithm_version: string;
  client_ts: string;
};

const FLUSH_MS = 2000;
const MAX_QUEUE = 40;

let queue: EventRow[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function track(event: EventName, fields: EventFields = {}): void {
  queue.push({
    ...fields,
    props: fields.props ?? {},
    event,
    user_id: getUserId(),
    algorithm_version: ALGORITHM_VERSION,
    client_ts: new Date().toISOString(),
  });
  if (queue.length >= MAX_QUEUE) flush();
  else if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

// Fire-and-forget: analytics must never block a swipe or surface an error to the player.
export function flush(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;
  const rows = queue;
  queue = [];
  try {
    void supabase.from('events').insert(rows).then(({ error }) => {
      if (error) console.warn('[OmNom] events insert failed:', error.message);
    });
  } catch (e) {
    console.warn('[OmNom] events insert exception:', e);
  }
}

// Telegram can kill the webview without warning; these two cover backgrounding and close.
// Anything queued in the last FLUSH_MS may still be lost — abandonment is therefore also
// derivable server-side: a session_id with question_shown but no test_completed.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}
