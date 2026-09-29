// Explicit .ts extension: this module is also loaded directly by node (tests, scripts).
import { ALGORITHM_VERSION } from './engine.ts';
import type { Answer, Mode, Session } from './engine.ts';

// «Угадали?» → yes: the guessed dish was the target; no + search: the dish the player picked; skipped: unknown.
export type Feedback = { guessed: boolean; targetDishId: string | null };

export type SessionAnswerRow = {
  session_id: string;
  mode: Mode;
  cuisine: string;
  question_id: string;
  answer: Answer;
  guessed_dish_id: string | null;
  target_dish_id: string | null;
  algorithm_version: string;
};

export function newSessionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildSessionRows(
  sessionId: string,
  session: Session,
  guessedDishId: string | null,
  feedback: Feedback | null,
): SessionAnswerRow[] {
  const target = feedback ? (feedback.guessed ? guessedDishId : feedback.targetDishId) : null;
  return session.log.map((e) => ({
    session_id: sessionId,
    mode: session.mode,
    cuisine: session.cuisine,
    question_id: e.questionId,
    answer: e.answer,
    guessed_dish_id: guessedDishId,
    target_dish_id: target,
    algorithm_version: ALGORITHM_VERSION,
  }));
}
