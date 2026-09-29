import { supabase } from '../lib/supabase';
import type { SessionAnswerRow } from './sessionRows';

export { buildSessionRows, newSessionId, type Feedback, type SessionAnswerRow } from './sessionRows';

export async function saveSessionAnswers(rows: SessionAnswerRow[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    const { error } = await supabase.from('session_answers').insert(rows);
    if (error) console.error('[OmNom] session_answers insert error:', error);
  } catch (e) {
    console.error('[OmNom] session_answers insert exception:', e);
  }
}
