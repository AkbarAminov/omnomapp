// "Target dish + noisy player": the player has a dish in mind and answers by its tags,
// deviating with probability p. Measures whether the engine still finds that dish.
import {
  applyAnswer, getCandidates, isFinished, pickNextQuestion, rankResults, startSession, traitValue,
} from '../../src/logic/engine.ts';
import type { Answer, Dish, Mode, Question, Rng } from '../../src/logic/engine.ts';

export type NoisyVariant = { label: string; mode: Mode; cuisine: string };

export type NoisyResult = {
  sessions: number;
  first: number;           // share of sessions where the target is shown first
  top3: number;            // share where the target is among the shown results
  swipes: number;          // average swipes per session
  maxFirstShare: number;   // share of sessions won by the most frequent #1 dish
  maxFirstDish: string;
};

export type QuestionNoiseStat = { asked: number; knockouts: number };

// The player answers «да» as often as the dish carries the trait: 0.75 → yes three times in four.
// Deviation p then replaces that answer with one of the other two, equally likely.
// Grading a dish is therefore not punished: a 0.75 dish is no longer treated as a flat «да».
export function playerAnswer(trait: number, p: number, rng: Rng): { answer: Answer; deviated: boolean } {
  const intended: Answer = rng() < trait ? 'yes' : 'no';
  if (rng() >= p) return { answer: intended, deviated: false };
  return { answer: rng() < 0.5 ? (intended === 'yes' ? 'no' : 'yes') : 'any', deviated: true };
}

export function runNoisy(
  dishes: readonly Dish[],
  questions: readonly Question[],
  v: NoisyVariant,
  p: number,
  runsPerDish: number,
  rng: Rng,
  qStats?: Map<string, QuestionNoiseStat>,
): NoisyResult {
  const pool = getCandidates(dishes, v.mode, v.cuisine, []);
  const firsts = new Map<string, number>();
  let n = 0, first = 0, top3 = 0, swipes = 0;
  for (const target of pool) {
    for (let r = 0; r < runsPerDish; r++) {
      let s = startSession(dishes, v.mode, v.cuisine, []);
      const deviatedOn: string[] = [];
      while (!isFinished(questions, s)) {
        const q = pickNextQuestion(questions, s)!;
        const { answer, deviated } = playerAnswer(traitValue(target, q.tag), p, rng);
        if (deviated) deviatedOn.push(q.id);
        if (qStats) {
          const st = qStats.get(q.id) ?? { asked: 0, knockouts: 0 };
          st.asked++;
          qStats.set(q.id, st);
        }
        s = applyAnswer(s, q, answer);
      }
      const shown = rankResults(s).dishes;
      n++;
      swipes += s.swipes;
      if (shown[0]) firsts.set(shown[0].id, (firsts.get(shown[0].id) ?? 0) + 1);
      if (shown[0]?.id === target.id) first++;
      const hit = shown.some((d) => d.id === target.id);
      if (hit) top3++;
      else if (qStats) for (const id of deviatedOn) qStats.get(id)!.knockouts++;
    }
  }
  const [maxFirstDish, maxCount] = [...firsts].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
  return {
    sessions: n,
    first: n ? first / n : 0,
    top3: n ? top3 / n : 0,
    swipes: n ? swipes / n : 0,
    maxFirstShare: n ? maxCount / n : 0,
    maxFirstDish: dishes.find((d) => d.id === maxFirstDish)?.name ?? '',
  };
}
