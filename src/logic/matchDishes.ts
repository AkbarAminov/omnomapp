import { supabase } from '../lib/supabase';

export type Answer = 'yes' | 'no' | 'any';

export type Dish = {
  id: string;
  name: string;
  name_uz?: string;
  description: string;
  description_uz?: string;
  cuisine: string;
  isHeavy: string;
  hasMeat: string;
  isHot: string;
  isSoup: string;
  isFast: string;
  emoji: string;
  image: string;
  allergens?: string[];
};

export type MatchedDish = Dish & {
  matchPercent: number;
};

const QUESTION_KEYS: (keyof Pick<Dish, 'isHeavy' | 'hasMeat' | 'isHot' | 'isSoup' | 'isFast'>)[] = [
  'isHeavy',
  'hasMeat',
  'isHot',
  'isSoup',
  'isFast',
];

// 2 = exact match, 1 = either side is "any", 0 = mismatch; max 5×2 = 10
function scoreOne(userAnswer: string, dishValue: string): number {
  if (userAnswer === dishValue) return 2;
  if (userAnswer === 'any' || dishValue === 'any') return 1;
  return 0;
}

// Deterministic ±4 pt variation per dish id so the same dish always shifts
// by the same amount — avoids a wall of identical percentages.
function idVariation(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 9) - 4; // –4 … +4
}

function calcPercent(dish: Dish, answers: Answer[]): number {
  let score = 0;
  QUESTION_KEYS.forEach((key, i) => {
    score += scoreOne(answers[i] ?? 'any', dish[key]);
  });
  const base = Math.round((score / 10) * 100);
  return Math.min(100, Math.max(0, base + idVariation(dish.id)));
}

// Sort key: displayed percent + tiny random noise (shuffles ties) + recency penalty.
// Never exposed to UI — only used for ordering.
function sortKey(percent: number, id: string, recent: Set<string>): number {
  return percent + Math.random() * 0.5 - (recent.has(id) ? 8 : 0);
}

let cachedDishes: Dish[] | null = null;
let loadPromise: Promise<void> | null = null;

export function loadDishes(): Promise<void> {
  if (cachedDishes !== null) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = (async () => {
      console.log('[OmNom] loadDishes: fetching...');
      const { data, error } = await supabase.from('dishes').select('*');
      console.log('[OmNom] loadDishes response — rows:', data?.length ?? 'null', '| error:', error);
      if (data?.length) console.log('[OmNom] loadDishes first row keys:', Object.keys(data[0]), '| values:', data[0]);
      if (error) {
        loadPromise = null;
        throw error;
      }
      cachedDishes = (data ?? []) as Dish[];
    })();
  }
  return loadPromise;
}

/**
 * Возвращает до 5 блюд:
 *   [0]   — лучшее из выбранной кухни (главный результат)
 *   [1-4] — лучшее из каждой остальной кухни, топ-4 по проценту
 *
 * excludeAllergens — ID ограничений из профиля (gluten / lactose / …).
 * recentIds        — последние ~6 показанных блюд; понижают их приоритет.
 */
export function matchDishes(
  cuisine: string,
  answers: Answer[],
  excludeAllergens: string[] = [],
  recentIds: string[] = [],
  topN: number = 5,
): MatchedDish[] {
  console.log('[OmNom] matchDishes called — cachedDishes:', cachedDishes?.length ?? 'null', '| cuisine:', cuisine);
  const allDishes = cachedDishes ?? [];

  const exclusions = new Set(excludeAllergens);
  const recent = new Set(recentIds);

  const isAllowed = (d: Dish) =>
    exclusions.size === 0 || !(d.allergens ?? []).some((a) => exclusions.has(a));

  // ── Best from selected cuisine ──────────────────────────────────────────────
  const cuisineDishes = allDishes
    .filter((d) => d.cuisine === cuisine && isAllowed(d))
    .map((d) => ({ ...d, matchPercent: calcPercent(d, answers) }));

  cuisineDishes.sort((a, b) => sortKey(b.matchPercent, b.id, recent) - sortKey(a.matchPercent, a.id, recent));
  const topFromCuisine = cuisineDishes[0];

  if (!topFromCuisine) return [];

  // ── Best from each other cuisine ────────────────────────────────────────────
  const otherDishes = allDishes
    .filter((d) => d.cuisine !== cuisine && isAllowed(d))
    .map((d) => ({ ...d, matchPercent: calcPercent(d, answers) }));

  otherDishes.sort((a, b) => sortKey(b.matchPercent, b.id, recent) - sortKey(a.matchPercent, a.id, recent));

  const seenCuisines = new Set<string>();
  const otherTop: MatchedDish[] = [];
  for (const dish of otherDishes) {
    if (!seenCuisines.has(dish.cuisine)) {
      seenCuisines.add(dish.cuisine);
      otherTop.push(dish);
      if (otherTop.length >= topN - 1) break;
    }
  }

  const result = [topFromCuisine, ...otherTop];
  console.log('[OmNom] matchDishes result[0] — id:', result[0]?.id, '| name:', result[0]?.name, '| image:', result[0]?.image, '| matchPercent:', result[0]?.matchPercent);
  return result;
}

// Module-level last id so getRandomDish never repeats back-to-back.
let lastRandomId = '';

/**
 * Случайное блюдо из всей базы; не повторяет последний показанный.
 */
export function getRandomDish(recentIds: string[] = []): MatchedDish | null {
  const allDishes = cachedDishes ?? [];
  if (allDishes.length === 0) return null;
  const avoid = new Set([...recentIds, lastRandomId]);
  const pool = allDishes.filter((d) => !avoid.has(d.id));
  const source = pool.length > 0 ? pool : allDishes.filter((d) => d.id !== lastRandomId);
  const dish = source[Math.floor(Math.random() * source.length)];
  lastRandomId = dish?.id ?? '';
  return { ...dish, matchPercent: Math.floor(Math.random() * 20) + 75 };
}
