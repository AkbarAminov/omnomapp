import { supabase } from '../lib/supabase';
import { Dish, normalizeDish, normalizeQuestion, Question } from './engine';

export type AppData = {
  dishes: Dish[];
  questions: Question[];
  dishById: Map<string, Dish>;
};

let cache: AppData | null = null;
let pending: Promise<AppData> | null = null;

export function getData(): AppData {
  if (!cache) throw new Error('loadData() must resolve before getData()');
  return cache;
}

export function loadData(): Promise<AppData> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = (async () => {
      const [dishesRes, questionsRes] = await Promise.all([
        supabase.from('dishes').select('*'),
        supabase.from('questions').select('*').order('priority'),
      ]);
      if (dishesRes.error) throw dishesRes.error;
      if (questionsRes.error) throw questionsRes.error;
      const dishes = (dishesRes.data ?? []).map(normalizeDish);
      const questions = (questionsRes.data ?? []).map(normalizeQuestion);
      if (dishes.length === 0 || questions.length === 0) throw new Error('Empty dishes or questions table');
      cache = { dishes, questions, dishById: new Map(dishes.map((d) => [d.id, d])) };
      return cache;
    })().finally(() => { pending = null; });
  }
  return pending;
}
